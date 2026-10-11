import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { notify } from "@/server/events-service";

type ClubTx = Prisma.TransactionClient;
async function approvedActor(tx: ClubTx, actorId: string, roles: string[]) {
  const actor = await tx.user.findUnique({
    where: { id: actorId },
    include: { member: { include: { membership: true } } },
  });
  if (
    !actor ||
    !roles.includes(actor.role) ||
    actor.approvalStatus !== "APPROVED" ||
    !actor.emailVerifiedAt ||
    actor.disabledAt
  )
    throw new Error("Your account cannot perform this operation.");
  return actor;
}
async function serialTransaction<T>(
  database: PrismaClient,
  work: (tx: ClubTx) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await database.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10000,
        timeout: 15000,
      });
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !["P2034", "P2002"].includes(error.code) ||
        attempt === 3
      )
        throw error;
    }
  }
  throw new Error("This operation is busy. Please retry.");
}
export function activeMembership(
  membership: { status: string; expiresAt: Date } | null | undefined,
  now = new Date(),
) {
  return (
    !!membership && membership.status === "ACTIVE" && membership.expiresAt > now
  );
}
export function merchandisePrice(
  item: { priceCents: number; memberPriceCents: number | null },
  eligible: boolean,
) {
  return eligible && item.memberPriceCents !== null
    ? item.memberPriceCents
    : item.priceCents;
}
export function receiptLink(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null;
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    /[\u0000-\u0020\u007f]/.test(value)
  )
    return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export async function setMembershipDuesRecord(
  actorId: string,
  memberId: string,
  duesCents: number,
  database: PrismaClient = db,
) {
  if (
    !memberId ||
    !Number.isSafeInteger(duesCents) ||
    duesCents < 1 ||
    duesCents > 10_000_000
  )
    throw new Error(
      "Choose a member and positive annual dues up to 100,000 USD.",
    );
  return serialTransaction(database, async (tx) => {
    await approvedActor(tx, actorId, ["STAFF", "TREASURER"]);
    if (!(await tx.member.findUnique({ where: { id: memberId } })))
      throw new Error("This member no longer exists.");
    await tx.membership.upsert({
      where: { memberId },
      create: { memberId, duesCents, status: "PENDING", expiresAt: new Date() },
      update: { duesCents },
    });
    return {
      ok: true,
      message:
        "Annual dues saved. This does not record payment or activate membership.",
    };
  });
}
export async function recordMembershipDues(
  actorId: string,
  memberId: string,
  database: PrismaClient = db,
) {
  return serialTransaction(database, async (tx) => {
    await approvedActor(tx, actorId, ["STAFF", "TREASURER"]);
    const member = await tx.member.findUnique({
      where: { id: memberId },
      include: { membership: true },
    });
    if (
      !member?.membership ||
      !Number.isSafeInteger(member.membership.duesCents) ||
      member.membership.duesCents < 1 ||
      member.membership.duesCents > 10_000_000
    )
      throw new Error("Set positive annual dues before recording payment.");
    const now = new Date();
    const renewalWindow = new Date(now.getTime() + 30 * 86400000);
    const expiresAt = new Date(
      member.membership.status === "ACTIVE" && member.membership.expiresAt > now
        ? member.membership.expiresAt
        : now,
    );
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const saved = await tx.membership.updateMany({
      where: {
        memberId,
        expiresAt: member.membership.expiresAt,
        OR: [
          { status: { not: "ACTIVE" } },
          { expiresAt: { lte: renewalWindow } },
        ],
      },
      data: { status: "ACTIVE", expiresAt },
    });
    if (!saved.count)
      return {
        ok: false,
        message:
          "Membership is active and not due for renewal within 30 days. No duplicate dues were recorded.",
      };
    await tx.transaction.create({
      data: {
        type: "INCOME",
        category: "DUES",
        description: `Membership dues — ${member.name}`,
        amountCents: member.membership.duesCents,
        memberId,
        currency: "USD",
      },
    });
    return {
      ok: true,
      message: "Dues recorded. Membership is active for one year.",
    };
  });
}
export async function processMembershipUpdates(
  database: PrismaClient = db,
  now = new Date(),
  memberIds?: string[],
) {
  const scope = memberIds ? { memberId: { in: memberIds } } : {};
  await database.membership.updateMany({
    where: { ...scope, status: "ACTIVE", expiresAt: { lte: now } },
    data: { status: "EXPIRED" },
  });
  const rows = await database.membership.findMany({
    where: {
      ...scope,
      status: { in: ["ACTIVE", "EXPIRED"] },
      expiresAt: { lte: new Date(now.getTime() + 30 * 86400000) },
    },
    select: { id: true },
  });
  for (const row of rows)
    await serialTransaction(database, async (tx) => {
      const membership = await tx.membership.findUnique({
        where: { id: row.id },
        include: { member: { include: { user: true } } },
      });
      const user = membership?.member.user;
      if (
        !membership ||
        !user ||
        user.disabledAt ||
        !user.emailVerifiedAt ||
        user.approvalStatus !== "APPROVED" ||
        !["ACTIVE", "EXPIRED"].includes(membership.status)
      )
        return;
      const expired = membership.expiresAt <= now;
      if (
        !expired &&
        membership.expiresAt.getTime() > now.getTime() + 30 * 86400000
      )
        return;
      const stage = expired ? "expired" : "renewal";
      await notify(
        tx,
        user.id,
        `membership:${membership.id}:${membership.expiresAt.getTime()}:${stage}`,
        expired
          ? "Your club membership has expired"
          : "Your club membership is due for renewal",
        `Membership expires ${membership.expiresAt.toISOString().slice(0, 10)}. Contact Staff or the Treasurer to arrange dues and renewal.`,
        "/account",
      );
    });
  return rows.length;
}
export async function publishClubAnnouncement(
  actorId: string,
  title: string,
  body: string,
  requestKey: string,
  database: PrismaClient = db,
  audienceUserIds?: string[],
) {
  if (
    typeof title !== "string" ||
    title.trim().length < 3 ||
    title.length > 120 ||
    typeof body !== "string" ||
    body.trim().length < 10 ||
    body.length > 4000 ||
    !/^[a-f0-9-]{36}$/.test(requestKey)
  )
    throw new Error(
      "Enter a title of 3–120 characters and a message of 10–4,000 characters.",
    );
  return serialTransaction(database, async (tx) => {
    await approvedActor(tx, actorId, ["STAFF", "TREASURER"]);
    const id = `notice-${actorId}-${requestKey}`;
    if (await tx.announcement.findUnique({ where: { id } }))
      return {
        ok: true,
        message:
          "This notice is already published. No duplicate mailing was created.",
      };
    await tx.announcement.create({
      data: {
        id,
        title: title.trim(),
        body: body.trim(),
        audience: "Approved club accounts",
      },
    });
    const users = await tx.user.findMany({
      where: {
        ...(audienceUserIds ? { id: { in: audienceUserIds } } : {}),
        approvalStatus: "APPROVED",
        emailVerifiedAt: { not: null },
        disabledAt: null,
      },
      select: { id: true, emailReminders: true },
    });
    for (const user of users)
      await notify(
        tx,
        user.id,
        `announcement:${id}:${user.id}`,
        title.trim(),
        body.trim(),
        "/announcements",
      );
    return {
      ok: true,
      message: `Notice published. ${users.length} in-app updates saved; ${users.filter((u) => u.emailReminders).length} emails queued for the worker. Queuing is not confirmation of inbox delivery.`,
    };
  });
}
export async function orderClubMerchandise(
  actorId: string,
  itemId: string,
  quantity: number,
  database: PrismaClient = db,
) {
  if (
    !itemId ||
    !Number.isSafeInteger(quantity) ||
    quantity < 1 ||
    quantity > 10
  )
    throw new Error("Choose a product and a whole quantity from 1 to 10.");
  return serialTransaction(database, async (tx) => {
    const actor = await approvedActor(tx, actorId, ["MEMBER", "STAFF"]);
    const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
    if (!item) throw new Error("This product is no longer available.");
    const unitPriceCents = merchandisePrice(
      item,
      activeMembership(actor.member?.membership),
    );
    if (
      !Number.isSafeInteger(unitPriceCents) ||
      unitPriceCents < 0 ||
      unitPriceCents > 10_000_000 ||
      (item.memberPriceCents !== null &&
        (item.memberPriceCents < 0 || item.memberPriceCents > item.priceCents))
    )
      throw new Error("This item's price needs Staff attention.");
    const changed = await tx.inventoryItem.updateMany({
      where: { id: itemId, stock: { gte: quantity } },
      data: { stock: { decrement: quantity } },
    });
    if (!changed.count)
      throw new Error(
        "Not enough stock in this size. Refresh and choose a smaller quantity.",
      );
    const totalCents = unitPriceCents * quantity;
    const order = await tx.merchandiseOrder.create({
      data: {
        userId: actor.id,
        memberId: actor.memberId,
        status: "PAID",
        totalCents,
        lines: { create: { itemId, quantity, unitPriceCents } },
      },
    });
    await tx.transaction.create({
      data: {
        type: "INCOME",
        category: "MERCHANDISE",
        description: `${quantity} × ${item.name} (${item.size ?? "One size"}) · ${order.id}`,
        amountCents: totalCents,
        memberId: actor.memberId,
        currency: "USD",
      },
    });
    return {
      ok: true,
      message:
        "Practice order recorded. Stock and ledger updated; no online payment collected.",
    };
  });
}
export async function fulfillClubOrder(
  actorId: string,
  orderId: string,
  database: PrismaClient = db,
) {
  return serialTransaction(database, async (tx) => {
    await approvedActor(tx, actorId, ["STAFF"]);
    const order = await tx.merchandiseOrder.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new Error("This order no longer exists.");
    const updated = await tx.merchandiseOrder.updateMany({
      where: { id: orderId, status: "PAID" },
      data: { status: "FULFILLED", fulfilledAt: new Date() },
    });
    if (!updated.count)
      return {
        ok: false,
        message:
          "This order is already collected or is not ready for collection.",
      };
    if (order.userId)
      await notify(
        tx,
        order.userId,
        `collection:${order.id}`,
        "Club order collected",
        "Staff recorded collection of your club merchandise.",
        "/merchandise",
      );
    return {
      ok: true,
      message: "Collection recorded. Stock and income were not posted again.",
    };
  });
}
export async function recordFundraiserIncome(
  actorId: string,
  description: string,
  amountCents: number,
  currency: string,
  requestKey: string,
  database: PrismaClient = db,
) {
  if (
    typeof description !== "string" ||
    description.trim().length < 3 ||
    description.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(description) ||
    !Number.isSafeInteger(amountCents) ||
    amountCents < 1 ||
    amountCents > 10_000_000 ||
    !["USD", "INR"].includes(currency) ||
    !/^[a-f0-9-]{36}$/.test(requestKey)
  )
    throw new Error(
      "Enter a description, positive amount up to 100,000, and USD or INR.",
    );
  return serialTransaction(database, async (tx) => {
    await approvedActor(tx, actorId, ["TREASURER"]);
    const id = `fundraiser-${actorId}-${requestKey}`;
    if (await tx.transaction.findUnique({ where: { id } }))
      return {
        ok: true,
        message:
          "This fundraiser receipt is already recorded; no duplicate income posted.",
      };
    await tx.transaction.create({
      data: {
        id,
        type: "INCOME",
        category: "FUNDRAISER",
        description: description.trim(),
        amountCents,
        currency,
        status: "posted",
        reviewedById: actorId,
        reviewedAt: new Date(),
      },
    });
    return {
      ok: true,
      message:
        "Fundraiser receipts recorded in the ledger. This records money received separately; it does not collect an online payment.",
    };
  });
}
