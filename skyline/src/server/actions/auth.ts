"use server";
import { deliverQueuedEmail } from "@/server/email";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  newToken,
  tokenHash,
} from "@/lib/password";
import {
  requireUser,
  requireRole,
  requireSessionUser,
  requireApprover,
  roleHome,
} from "@/server/auth";
import { linkVerifiedMembership } from "@/server/accounts-service";
import { validName, validEmail } from "@/lib/validation";
import { issueEmailOtp, verifyEmailOtp } from "@/server/otp-service";
const dummyPasswordHash = hashPassword("not-a-user-password");

async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db.session.create({
    data: { id: tokenHash(token), userId, expiresAt },
  });
  cookies().set("skyline_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  cookies().delete("skyline_role");
}
async function accountEmail(
  userId: string,
  email: string,
  kind: "VERIFY" | "RESET",
) {
  const token = newToken();
  const base = process.env.APP_URL || "http://localhost:3001";
  const href = `${base}/${kind === "VERIFY" ? "verify-email" : "reset-password"}?token=${token}`;
  await db.$transaction(async (tx) => {
    await tx.accountToken.deleteMany({ where: { userId, kind } });
    await tx.accountToken.create({
      data: {
        id: tokenHash(token),
        userId,
        kind,
        expiresAt: new Date(
          Date.now() + (kind === "VERIFY" ? 24 : 1) * 3600000,
        ),
      },
    });
    await tx.emailMessage.create({
      data: {
        key: `account:${tokenHash(token)}`,
        to: email,
        subject:
          kind === "VERIFY"
            ? "Verify your Skyline email"
            : "Reset your Skyline password",
        body: `Open this one-time link: ${href}\nThis link expires in ${kind === "VERIFY" ? "24 hours" : "1 hour"}. If you did not request this, ignore it.`,
      },
    });
  });
}
export async function login(data: FormData) {
  const email = String(data.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(data.get("password") || "");
  if (email.length > 254 || password.length > 256)
    return { ok: false, message: "Email or password is incorrect." };
  const key = tokenHash(email);
  const attempt = await db.loginAttempt.findUnique({ where: { id: key } });
  if (
    attempt &&
    attempt.failures >= 5 &&
    Date.now() - attempt.updatedAt.getTime() < 15 * 60000
  )
    return {
      ok: false,
      message: "Too many attempts. Please try again in 15 minutes.",
    };
  const user = await db.user.findUnique({ where: { email } });
  const valid = verifyPassword(
    password,
    user?.passwordHash || dummyPasswordHash,
  );
  if (!user || !valid || user.disabledAt) {
    await db.loginAttempt.upsert({
      where: { id: key },
      create: { id: key, failures: 1 },
      update: {
        failures:
          attempt && Date.now() - attempt.updatedAt.getTime() >= 15 * 60000
            ? 1
            : { increment: 1 },
      },
    });
    return { ok: false, message: "Email or password is incorrect." };
  }
  await db.loginAttempt.deleteMany({ where: { id: key } });
  await createSession(user.id);
  redirect(
    !user.emailVerifiedAt
      ? "/verify-email"
      : user.approvalStatus !== "APPROVED"
        ? "/access-status"
        : roleHome(user.role),
  );
}
export async function register(data: FormData) {
  const name = String(data.get("name") || "").trim(),
    email = String(data.get("email") || "")
      .trim()
      .toLowerCase(),
    password = String(data.get("password") || ""),
    requestedRole = String(data.get("requestedRole") || "MEMBER");
  if (
    !validName(name) ||
    !validEmail(email) ||
    password.length < 12 ||
    password.length > 256 ||
    password !== String(data.get("confirmPassword") || "") ||
    !["MEMBER", "STAFF", "TREASURER"].includes(requestedRole)
  )
    return {
      ok: false,
      message:
        "Check name, email, matching passwords (12–256 characters), and requested role.",
    };
  const requestKey = tokenHash(
    "registration:" +
      (headers().get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "local-client"),
  );
  const recent = await db.loginAttempt.findUnique({
    where: { id: requestKey },
  });
  if (
    recent &&
    recent.failures >= 10 &&
    Date.now() - recent.updatedAt.getTime() < 3600000
  )
    return {
      ok: false,
      message: "Registration limit reached. Try again in one hour.",
    };
  await db.loginAttempt.upsert({
    where: { id: requestKey },
    create: { id: requestKey, failures: 1 },
    update: {
      failures:
        recent && Date.now() - recent.updatedAt.getTime() < 3600000
          ? { increment: 1 }
          : 1,
    },
  });
  let user;
  try {
    user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        requestedRole,
        approvalStatus: "PENDING",
        role: "MEMBER",
      },
    });
  } catch {
    return {
      ok: false,
      message: "Unable to create this account. If already registered, sign in.",
    };
  }
  await createSession(user.id);
  try {
    const queued = await issueEmailOtp(user.id);
    await deliverQueuedEmail({ key: queued.emailKey });
  } catch {
    /* Verification page explains deferred delivery; access remains blocked. */
  }
  redirect("/verify-email");
}
export async function requestReset(data: FormData) {
  const email = String(data.get("email") || "")
    .trim()
    .toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user && !user.disabledAt) {
    const recent = await db.accountToken.findFirst({
      where: {
        userId: user.id,
        kind: "RESET",
        expiresAt: { gt: new Date(Date.now() + 55 * 60000) },
      },
    });
    if (!recent) await accountEmail(user.id, email, "RESET");
  }
  return {
    ok: true,
    message:
      "If that account exists, reset instructions are queued for email delivery. Delivery requires the club’s email service.",
  };
}
export async function resetPassword(data: FormData) {
  const password = String(data.get("password") || "");
  const id = tokenHash(String(data.get("token") || ""));
  if (password.length < 12 || password.length > 256)
    return { ok: false, message: "Use a password of 12–256 characters." };
  try {
    await db.$transaction(async (tx) => {
      const token = await tx.accountToken.findUnique({ where: { id } });
      if (!token || token.kind !== "RESET" || token.expiresAt <= new Date())
        throw new Error("Invalid link");
      await tx.accountToken.delete({ where: { id } });
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash: hashPassword(password) },
      });
      await tx.session.deleteMany({ where: { userId: token.userId } });
    });
    return {
      ok: true,
      message: "Password changed. Sign in with your new password.",
    };
  } catch {
    return {
      ok: false,
      message: "This reset link is invalid, expired, or already used.",
    };
  }
}
export async function verifyEmail(data: FormData) {
  const user = await requireSessionUser();
  try {
    await verifyEmailOtp(user.id, String(data.get("code") || ""));
    return {
      ok: true,
      message: "Email verified. Your requested role now awaits Staff approval.",
      href: "/access-status",
      linkLabel: "View approval status",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Verification failed.",
    };
  }
}
export async function resendVerification() {
  const user = await requireSessionUser();
  if (user.emailVerifiedAt)
    return { ok: true, message: "Email is already verified." };
  try {
    const queued = await issueEmailOtp(user.id);
    const delivery = await deliverQueuedEmail({ key: queued.emailKey });
    return {
      ok: delivery.sent === 1,
      message:
        delivery.sent === 1
          ? "Verification email accepted by the provider. Check inbox or spam; use the latest code."
          : "Delivery did not complete. Your account remains unverified. Check email configuration or retry after 60 seconds.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to request verification.",
    };
  }
}
export async function manageUser(data: FormData) {
  const actor = await requireApprover(),
    id = String(data.get("userId") || ""),
    decision = String(data.get("decision") || ""),
    reason = String(data.get("reason") || "").trim();
  if (
    !id ||
    id === actor.id ||
    !["APPROVED", "REJECTED", "DISABLED"].includes(decision) ||
    reason.length > 500
  )
    return {
      ok: false,
      message: "Choose a valid decision for another account.",
    };
  if (decision === "REJECTED" && reason.length < 3)
    return { ok: false, message: "Provide a rejection reason." };
  try {
    await db.$transaction(async (tx) => {
      const target = await tx.user.findUniqueOrThrow({ where: { id } });
      if (target.isRoleApprover)
        throw Error("The designated approver cannot be changed here.");
      if (
        decision === "APPROVED" &&
        (!target.emailVerifiedAt ||
          !["MEMBER", "STAFF", "TREASURER"].includes(target.requestedRole))
      )
        throw Error("Verify email before approving a valid requested role.");
      const changed = await tx.user.updateMany({
        where: {
          id,
          approvalStatus: target.approvalStatus,
          approvedAt: target.approvedAt,
          requestedRole: target.requestedRole,
          disabledAt: target.disabledAt,
        },
        data: {
          approvalStatus:
            decision === "DISABLED" ? target.approvalStatus : decision,
          role: decision === "APPROVED" ? target.requestedRole : target.role,
          approvedById: actor.id,
          approvedAt: new Date(),
          approvalReason: reason || null,
          disabledAt: decision === "DISABLED" ? new Date() : null,
        },
      });
      if (!changed.count)
        throw Error("Account changed; refresh before reviewing.");
      if (decision === "APPROVED" && target.requestedRole === "MEMBER") {
        const member = await tx.member.upsert({
          where: { email: target.email },
          create: { name: target.name, email: target.email },
          update: {},
        });
        await tx.user.update({ where: { id }, data: { memberId: member.id } });
      }
      await tx.session.deleteMany({ where: { userId: id } });
    });
    return {
      ok: true,
      message: "Access decision recorded; existing sessions revoked.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && !("code" in error)
          ? error.message
          : "Unable to update access.",
    };
  }
}
export async function signOut() {
  const token = cookies().get("skyline_session")?.value;
  if (token) await db.session.deleteMany({ where: { id: tokenHash(token) } });
  cookies().delete("skyline_session");
  cookies().delete("skyline_role");
  redirect("/login");
}

export async function confirmIdentity() {
  await requireApprover();
  return {
    ok: false,
    message: "New users must verify email with OTP. Manual bypass is disabled.",
  };
}

export async function updateAccount(data: FormData) {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { emailReminders: data.get("emailReminders") === "on" },
  });
  return { ok: true, message: "Preferences saved." };
}
