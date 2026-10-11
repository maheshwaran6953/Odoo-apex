"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { moneyCents, validEmail, validName } from "@/lib/validation";
import { requireRole, requireUser } from "@/server/auth";
import {
  recordMembershipDues,
  setMembershipDuesRecord,
} from "@/server/club-service";
function refreshMembership() {
  for (const path of [
    "/members",
    "/account",
    "/events",
    "/merchandise",
    "/treasurer",
    "/",
  ])
    revalidatePath(path);
}
export async function activateMembership(memberId: string) {
  await requireRole(["STAFF", "TREASURER"]);
  const user = await requireUser();
  if (typeof memberId !== "string" || !memberId.trim())
    return { ok: false, message: "Choose a membership." };
  try {
    const result = await recordMembershipDues(user.id, memberId);
    if (result.ok) refreshMembership();
    return result;
  } catch {
    return {
      ok: false,
      message:
        "Could not record dues. Ensure positive annual dues are set, then refresh and try again.",
    };
  }
}
export async function renewMembership(memberId: string) {
  return activateMembership(memberId);
}
export async function setMembershipDues(memberId: string, data: FormData) {
  await requireRole(["STAFF", "TREASURER"]);
  const user = await requireUser();
  const duesCents = moneyCents(data.get("dues"));
  if (duesCents === null)
    return {
      ok: false,
      message:
        "Enter positive annual USD dues up to 100,000, with at most two decimals.",
    };
  try {
    const result = await setMembershipDuesRecord(user.id, memberId, duesCents);
    refreshMembership();
    return result;
  } catch {
    return {
      ok: false,
      message:
        "Unable to save dues for this membership. Refresh and try again.",
    };
  }
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
        "Enter a name, valid email, and positive annual dues with at most two decimals.",
    };
  try {
    await db.$transaction(async (tx) => {
      const account = await tx.user.findUnique({ where: { email } });
      if (account?.memberId) throw new Error("Already linked");
      const member = await tx.member.create({
        data: {
          name,
          email,
          membership: {
            create: { duesCents, expiresAt: new Date(), status: "PENDING" },
          },
        },
      });
      if (account)
        await tx.user.update({
          where: { id: account.id },
          data: { memberId: member.id },
        });
    });
    refreshMembership();
    return {
      ok: true,
      message:
        "Member added. Record separately received dues to activate membership.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Could not add this member. Check the directory for an existing email and set dues there instead.",
    };
  }
}
