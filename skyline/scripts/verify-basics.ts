import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
async function main() {
  if (!process.argv.includes("--temporary-fixtures"))
    throw new Error("Pass --temporary-fixtures for isolated verification.");
  loadEnvConfig(process.cwd());
  const { db } = await import("../src/lib/db");
  const {
    setMembershipDuesRecord,
    recordMembershipDues,
    processMembershipUpdates,
    publishClubAnnouncement,
    orderClubMerchandise,
    fulfillClubOrder,
    recordFundraiserIncome,
    receiptLink,
    activeMembership,
  } = await import("../src/server/club-service");
  const { deliverQueuedEmail } = await import("../src/server/email");
  const tag = `basics-${randomUUID()}`;
  const userIds: string[] = [],
    memberIds: string[] = [],
    itemIds: string[] = [];
  const noticeKey = randomUUID(),
    fundraiserKey = randomUUID();
  let noticeId = "",
    fundraiserId = "";
  const baseline = await db.transaction.findMany({ orderBy: { id: "asc" } });
  const baselineNotices = await db.announcement.count();
  const baselineEmails = await db.emailMessage.count();
  try {
    const makeUser = async (
      role: string,
      approvalStatus = "APPROVED",
      verified = true,
      disabled = false,
    ) => {
      const id = `${tag}-u${userIds.length}`;
      userIds.push(id);
      return db.user.create({
        data: {
          id,
          email: `${id}@skyline.example`,
          name: tag,
          passwordHash: "NOT_A_VALID_LOGIN_HASH",
          role,
          requestedRole: role,
          approvalStatus,
          emailVerifiedAt: verified ? new Date() : null,
          disabledAt: disabled ? new Date() : null,
          emailReminders: false,
        },
      });
    };
    const staff = await makeUser("STAFF"),
      treasurer = await makeUser("TREASURER"),
      member = await makeUser("MEMBER"),
      other = await makeUser("MEMBER"),
      pending = await makeUser("MEMBER", "PENDING"),
      unverified = await makeUser("MEMBER", "APPROVED", false),
      disabled = await makeUser("MEMBER", "APPROVED", true, true);
    for (const user of [member, other]) {
      const id = `${tag}-m${memberIds.length}`;
      memberIds.push(id);
      await db.member.create({ data: { id, name: tag, email: user.email } });
      await db.user.update({ where: { id: user.id }, data: { memberId: id } });
    }
    for (const cents of [-1, 0, 1.5, Infinity, 10_000_001])
      await assert.rejects(
        setMembershipDuesRecord(staff.id, memberIds[0], cents, db),
      );
    await assert.rejects(
      setMembershipDuesRecord(member.id, memberIds[0], 1200, db),
    );
    await setMembershipDuesRecord(staff.id, memberIds[0], 1200, db);
    assert.equal(
      (
        await db.membership.findUniqueOrThrow({
          where: { memberId: memberIds[0] },
        })
      ).status,
      "PENDING",
    );
    const activations = await Promise.all([
      recordMembershipDues(staff.id, memberIds[0], db),
      recordMembershipDues(treasurer.id, memberIds[0], db),
    ]);
    assert.equal(activations.filter((result) => result.ok).length, 1);
    assert.equal(
      await db.transaction.count({
        where: { memberId: memberIds[0], category: "DUES" },
      }),
      1,
    );
    const expiry = new Date(Date.now() + 10 * 86400000);
    await db.membership.update({
      where: { memberId: memberIds[0] },
      data: { expiresAt: expiry },
    });
    await db.user.update({
      where: { id: member.id },
      data: { emailReminders: true },
    });
    await Promise.all([
      processMembershipUpdates(db, new Date(), memberIds),
      processMembershipUpdates(db, new Date(), memberIds),
    ]);
    const membership = await db.membership.findUniqueOrThrow({
      where: { memberId: memberIds[0] },
    });
    const reminderKey = `membership:${membership.id}:${expiry.getTime()}:renewal`;
    assert.equal(
      await db.notification.count({ where: { key: reminderKey } }),
      1,
    );
    assert.equal(
      await db.emailMessage.count({ where: { key: reminderKey } }),
      1,
    );
    await recordMembershipDues(staff.id, memberIds[0], db);
    const renewed = await db.membership.findUniqueOrThrow({
      where: { memberId: memberIds[0] },
    });
    const expectedRenewal = new Date(expiry);
    expectedRenewal.setFullYear(expectedRenewal.getFullYear() + 1);
    assert.equal(
      renewed.expiresAt.getTime(),
      expectedRenewal.getTime(),
      "early renewal preserves remaining paid time",
    );
    assert.equal(
      (await recordMembershipDues(staff.id, memberIds[0], db)).ok,
      false,
      "early renewal cannot post twice",
    );
    await db.membership.update({
      where: { memberId: memberIds[0] },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await processMembershipUpdates(db, new Date(), memberIds);
    assert.equal(
      (
        await db.membership.findUniqueOrThrow({
          where: { memberId: memberIds[0] },
        })
      ).status,
      "EXPIRED",
    );
    await recordMembershipDues(staff.id, memberIds[0], db);
    let dispatched = 0;
    await deliverQueuedEmail({ key: reminderKey }, async () => {
      dispatched++;
      return "fake";
    });
    assert.equal(dispatched, 0, "renewed membership invalidates old email");
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { key: reminderKey } }))
        .status,
      "CANCELLED",
    );
    assert.equal(
      activeMembership({ status: "ACTIVE", expiresAt: new Date(0) }),
      false,
    );
    console.log(
      "PASS: dues setup, concurrent single posting, renewal reminders, expiry and stale email cancellation",
    );
    await assert.rejects(
      publishClubAnnouncement(
        member.id,
        "Club meeting",
        "Join us for the next club meeting.",
        noticeKey,
        db,
        userIds,
      ),
    );
    await Promise.all([
      publishClubAnnouncement(
        staff.id,
        "Club meeting",
        "Join us for the next club meeting.",
        noticeKey,
        db,
        userIds,
      ),
      publishClubAnnouncement(
        staff.id,
        "Club meeting",
        "Join us for the next club meeting.",
        noticeKey,
        db,
        userIds,
      ),
    ]);
    noticeId = `notice-${staff.id}-${noticeKey}`;
    assert.equal(await db.announcement.count({ where: { id: noticeId } }), 1);
    assert.equal(
      await db.notification.count({
        where: { key: { startsWith: `announcement:${noticeId}:` } },
      }),
      4,
    );
    assert.equal(
      await db.emailMessage.count({
        where: { key: { startsWith: `announcement:${noticeId}:` } },
      }),
      1,
      "only opted-in approved verified users queued",
    );
    await db.user.update({
      where: { id: member.id },
      data: { emailReminders: false },
    });
    const noticeEmailKey = `announcement:${noticeId}:${member.id}`;
    await deliverQueuedEmail({ key: noticeEmailKey }, async () => {
      dispatched++;
      return "fake";
    });
    assert.equal(dispatched, 0, "opt-out honored before dispatch");
    console.log(
      "PASS: announcement permission, duplicate publication, restricted audience and email preference",
    );
    const itemId = `${tag}-item`;
    itemIds.push(itemId);
    await db.inventoryItem.create({
      data: {
        id: itemId,
        name: tag,
        category: "Hoodie",
        size: "M",
        priceCents: 3000,
        memberPriceCents: 2500,
        stock: 1,
      },
    });
    await assert.rejects(orderClubMerchandise(treasurer.id, itemId, 1, db));
    for (const actor of [pending, unverified, disabled])
      await assert.rejects(orderClubMerchandise(actor.id, itemId, 1, db));
    for (const qty of [-1, 0, 1.1, Infinity, 11])
      await assert.rejects(orderClubMerchandise(member.id, itemId, qty, db));
    const race = await Promise.allSettled([
      orderClubMerchandise(member.id, itemId, 1, db),
      orderClubMerchandise(other.id, itemId, 1, db),
    ]);
    assert.equal(
      race.filter((result) => result.status === "fulfilled").length,
      1,
    );
    assert.equal(
      (await db.inventoryItem.findUniqueOrThrow({ where: { id: itemId } }))
        .stock,
      0,
    );
    const order = await db.merchandiseOrder.findFirstOrThrow({
      where: { userId: { in: [member.id, other.id] } },
      include: { lines: true },
    });
    assert.equal(order.totalCents, order.userId === member.id ? 2500 : 3000);
    assert.equal(order.lines[0].unitPriceCents, order.totalCents);
    await assert.rejects(fulfillClubOrder(member.id, order.id, db));
    const beforeCollection = await db.transaction.count({
      where: { description: { endsWith: order.id } },
    });
    const collections = await Promise.all([
      fulfillClubOrder(staff.id, order.id, db),
      fulfillClubOrder(staff.id, order.id, db),
    ]);
    assert.equal(collections.filter((result) => result.ok).length, 1);
    assert.equal(
      (await db.merchandiseOrder.findUniqueOrThrow({ where: { id: order.id } }))
        .status,
      "FULFILLED",
    );
    assert.equal(
      await db.transaction.count({
        where: { description: { endsWith: order.id } },
      }),
      beforeCollection,
    );
    await db.inventoryItem.update({
      where: { id: itemId },
      data: { stock: 2 },
    });
    await orderClubMerchandise(member.id, itemId, 1, db);
    assert.equal(
      (
        await db.merchandiseOrder.findFirstOrThrow({
          where: { userId: member.id, status: "PAID" },
        })
      ).totalCents,
      2500,
    );
    await db.membership.update({
      where: { memberId: memberIds[0] },
      data: { expiresAt: new Date(0) },
    });
    await orderClubMerchandise(member.id, itemId, 1, db);
    const ordinary = await db.merchandiseOrder.findFirstOrThrow({
      where: { userId: member.id, status: "PAID", totalCents: 3000 },
    });
    assert.equal(
      ordinary.totalCents,
      3000,
      "expired members pay regular price",
    );
    console.log(
      "PASS: stock race, eligibility/pricing snapshots, invalid quantities and exactly-once collection",
    );
    fundraiserId = `fundraiser-${treasurer.id}-${fundraiserKey}`;
    await assert.rejects(
      recordFundraiserIncome(
        staff.id,
        "Bake sale",
        1234,
        "INR",
        fundraiserKey,
        db,
      ),
    );
    await assert.rejects(
      recordFundraiserIncome(
        treasurer.id,
        "Bake sale",
        -1,
        "INR",
        fundraiserKey,
        db,
      ),
    );
    await Promise.all([
      recordFundraiserIncome(
        treasurer.id,
        "Bake sale",
        1234,
        "INR",
        fundraiserKey,
        db,
      ),
      recordFundraiserIncome(
        treasurer.id,
        "Bake sale",
        1234,
        "INR",
        fundraiserKey,
        db,
      ),
    ]);
    assert.equal(
      await db.transaction.count({ where: { id: fundraiserId } }),
      1,
    );
    assert.equal(
      (await db.transaction.findUniqueOrThrow({ where: { id: fundraiserId } }))
        .currency,
      "INR",
    );
    assert.equal(
      receiptLink("https://example.com/receipt"),
      "https://example.com/receipt",
    );
    for (const value of [
      "javascript:alert(1)",
      "http://example.com",
      "https://user:pass@example.com",
      "invalid",
      "https://example.com/\n",
    ])
      assert.equal(receiptLink(value), undefined);
    assert.equal(receiptLink(""), null);
    console.log(
      "PASS: fundraiser permission/idempotency, currency and safe receipt metadata",
    );
  } finally {
    const orders = await db.merchandiseOrder.findMany({
      where: { userId: { in: userIds } },
      select: { id: true },
    });
    await db.merchandiseOrderLine.deleteMany({
      where: { orderId: { in: orders.map((o) => o.id) } },
    });
    await db.merchandiseOrder.deleteMany({
      where: { id: { in: orders.map((o) => o.id) } },
    });
    await db.inventoryItem.deleteMany({ where: { id: { in: itemIds } } });
    await db.transaction.deleteMany({
      where: {
        OR: [
          { memberId: { in: memberIds } },
          { id: `fundraiser-${userIds[1]}-${fundraiserKey}` },
          {
            description: { in: orders.map((o) => `1 × ${tag} (M) · ${o.id}`) },
          },
        ],
      },
    });
    await db.emailMessage.deleteMany({
      where: {
        OR: [
          { to: { in: userIds.map((id) => `${id}@skyline.example`) } },
          {
            key: {
              startsWith: `announcement:notice-${userIds[0]}-${noticeKey}:`,
            },
          },
        ],
      },
    });
    await db.notification.deleteMany({ where: { userId: { in: userIds } } });
    await db.announcement.deleteMany({
      where: { id: `notice-${userIds[0]}-${noticeKey}` },
    });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.membership.deleteMany({ where: { memberId: { in: memberIds } } });
    await db.member.deleteMany({ where: { id: { in: memberIds } } });
    assert.deepEqual(
      await db.transaction.findMany({ orderBy: { id: "asc" } }),
      baseline,
    );
    assert.equal(await db.announcement.count(), baselineNotices);
    assert.equal(await db.emailMessage.count(), baselineEmails);
    await db.$disconnect();
    console.log(
      "PASS: exact fixture cleanup preserved existing records; no provider emails sent",
    );
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Basic functionality check failed",
  );
  process.exitCode = 1;
});
