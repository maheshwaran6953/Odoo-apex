"use server";

import { db } from "@/lib/db";
import { moneyCents, validEmail, validName } from "@/lib/validation";
import { requireRole } from "@/server/auth";

export async function activateMembership(memberId: string) {
  await requireRole(["STAFF", "TREASURER"]);
  if (typeof memberId !== "string" || !memberId.trim())
    return { ok: false, message: "Choose a membership." };
  try {
    return await db.$transaction(async (tx) => {
      const member = await tx.member.findUnique({
        where: { id: memberId },
        include: { membership: true },
      });
      if (!member?.membership)
        return { ok: false, message: "Membership record was not found." };
      if (
        !Number.isSafeInteger(member.membership.duesCents) ||
        member.membership.duesCents <= 0
      )
        return {
          ok: false,
          message: "Set valid positive dues before activation.",
        };
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      // Compare-and-set prevents two concurrent approvals from recording duplicate dues.
      const saved = await tx.membership.updateMany({
        where: {
          memberId,
          OR: [{ status: { not: "ACTIVE" } }, { expiresAt: { lt: now } }],
        },
        data: { status: "ACTIVE", expiresAt },
      });
      if (!saved.count)
        return {
          ok: false,
          message:
            "This membership is already active. No duplicate dues were recorded.",
        };
      await tx.transaction.create({
        data: {
          type: "INCOME",
          category: "DUES",
          description: `Membership dues — ${member.name}`,
          amountCents: member.membership.duesCents,
          memberId,
        },
      });
      return {
        ok: true,
        message: `Dues recorded. ${member.name} is active for one year.`,
      };
    });
  } catch {
    return {
      ok: false,
      message: "Unable to update membership. Refresh and try again.",
    };
  }
}
export async function renewMembership(memberId: string) {
  return activateMembership(memberId);
}
export async function addMember(data: FormData) {
  await requireRole(["STAFF", "TREASURER"]);
  const name = String(data.get("name") ?? "").trim();
  const email = String(data.get("email") ?? "")
    .trim()
    .toLowerCase();
  const duesCents = moneyCents(data.get("dues"));
  if (!validName(name) || !validEmail(email) || duesCents === null)
    return {
      ok: false,
      message:
        "Enter a name, valid email, and positive annual dues with at most two decimal places.",
    };
  try {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await db.member.create({
      data: {
        name,
        email,
        membership: { create: { duesCents, expiresAt, status: "PENDING" } },
      },
    });
    return {
      ok: true,
      message: `${name} was added. Record their dues to activate membership.`,
    };
  } catch {
    return {
      ok: false,
      message: "Could not add this member. Check that the email is unique.",
    };
  }
}
