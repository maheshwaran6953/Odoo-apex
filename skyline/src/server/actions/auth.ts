"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  hashPassword,
  verifyPassword,
  newToken,
  tokenHash,
} from "@/lib/password";
import { requireUser, requireRole } from "@/server/auth";
import { linkVerifiedMembership } from "@/server/accounts-service";
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
  redirect("/my-events");
}
export async function register(data: FormData) {
  const name = String(data.get("name") || "").trim();
  const email = String(data.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(data.get("password") || "");
  if (
    name.length < 2 ||
    name.length > 100 ||
    email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    password.length < 12 ||
    password.length > 256
  )
    return {
      ok: false,
      message: "Use a name, valid email, and password of 12–256 characters.",
    };
  try {
    const user = await db.user.create({
      data: { name, email, passwordHash: hashPassword(password) },
    });
    await accountEmail(user.id, user.email, "VERIFY");
    await createSession(user.id);
  } catch {
    return {
      ok: false,
      message:
        "This account could not be created. Try signing in or contact club staff.",
    };
  }
  redirect("/my-events");
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
  const id = tokenHash(String(data.get("token") || ""));
  try {
    await db.$transaction(async (tx) => {
      const token = await tx.accountToken.findUnique({ where: { id } });
      if (!token || token.kind !== "VERIFY" || token.expiresAt <= new Date())
        throw new Error("Invalid link");
      const user = await tx.user.findUniqueOrThrow({
        where: { id: token.userId },
      });
      await tx.accountToken.delete({ where: { id } });
      await linkVerifiedMembership(tx, user.id, user.email);
    });
    return {
      ok: true,
      message:
        "Email verified. Any matching club membership is now linked to your account.",
    };
  } catch {
    return {
      ok: false,
      message: "This verification link is invalid, expired, or already used.",
    };
  }
}
export async function resendVerification() {
  const user = await requireUser();
  if (user.emailVerifiedAt)
    return { ok: true, message: "Your email is already verified." };
  const recent = await db.accountToken.findFirst({
    where: {
      userId: user.id,
      kind: "VERIFY",
      expiresAt: { gt: new Date(Date.now() + 23 * 3600000 + 55 * 60000) },
    },
  });
  if (recent)
    return {
      ok: false,
      message:
        "A verification message is already queued. Wait five minutes before requesting another.",
    };
  await accountEmail(user.id, user.email, "VERIFY");
  return {
    ok: true,
    message:
      "Verification email queued. Delivery requires the configured email service.",
  };
}
export async function updateAccount(data: FormData) {
  const user = await requireUser();
  await db.user.update({
    where: { id: user.id },
    data: { emailReminders: data.get("emailReminders") === "on" },
  });
  return {
    ok: true,
    message:
      "Reminder preferences saved. In-app event notices remain available.",
  };
}
export async function manageUser(data: FormData) {
  await requireRole(["STAFF"]);
  const actor = await requireUser();
  const id = String(data.get("userId") || "");
  const role = String(data.get("role") || "MEMBER");
  if (!["MEMBER", "STAFF", "TREASURER"].includes(role) || id === actor.id)
    return {
      ok: false,
      message: "Choose a valid role. You cannot change your own access here.",
    };
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        role,
        disabledAt: data.get("disabled") === "on" ? new Date() : null,
      },
    });
    await tx.session.deleteMany({ where: { userId: id } });
  });
  return {
    ok: true,
    message: "Access updated. Existing sessions for this user were revoked.",
  };
}
export async function signOut() {
  const token = cookies().get("skyline_session")?.value;
  if (token) await db.session.deleteMany({ where: { id: tokenHash(token) } });
  cookies().delete("skyline_session");
  cookies().delete("skyline_role");
  redirect("/login");
}

export async function confirmIdentity(data: FormData) {
  await requireRole(["STAFF"]);
  if (data.get("confirm") !== "on")
    return {
      ok: false,
      message:
        "Confirm that you checked this person’s identity and email ownership.",
    };
  const id = String(data.get("userId") || "");
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id } });
    if (user.disabledAt)
      throw new Error("Enable this account before verifying it.");
    await linkVerifiedMembership(tx, id, user.email);
    await tx.accountToken.deleteMany({ where: { userId: id, kind: "VERIFY" } });
  });
  return {
    ok: true,
    message: "Identity confirmed by staff. Matching club membership linked.",
  };
}
