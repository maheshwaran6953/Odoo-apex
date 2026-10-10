import { emailDeliveryConfigured } from "@/server/email-transport";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const TTL_MS = 10 * 60_000;
const COOLDOWN_MS = 60_000;
const WINDOW_MS = 60 * 60_000;
const MAX_REQUESTS = 5;
const MAX_ATTEMPTS = 5;

function secret() {
  const value = process.env.OTP_SECRET;
  if (!value || value.length < 32)
    throw new Error(
      "Email verification is unavailable until its security secret is configured.",
    );
  return value;
}
function digest(userId: string, code: string, requestedAt: Date) {
  return createHmac("sha256", secret())
    .update(`${userId}:${requestedAt.toISOString()}:${code}`)
    .digest("hex");
}
async function serializable<T>(
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code) &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new Error("Verification is busy. Please try again.");
}

export async function issueEmailOtp(userId: string) {
  secret();
  if (
    process.env.EMAIL_VERIFICATION_ENABLED !== "true" ||
    !emailDeliveryConfigured()
  )
    throw new Error(
      "Email verification delivery is not configured yet. Please contact the designated Staff account.",
    );
  return serializable(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.disabledAt)
      throw new Error("This account is unavailable.");
    if (user.emailVerifiedAt)
      throw new Error("Your email is already verified.");
    const now = new Date();
    const previous = await tx.emailOtp.findUnique({ where: { userId } });
    if (
      previous &&
      now.getTime() - previous.requestedAt.getTime() < COOLDOWN_MS
    )
      throw new Error("Please wait 60 seconds before requesting another code.");
    const sameWindow =
      previous &&
      now.getTime() - previous.windowStartedAt.getTime() < WINDOW_MS;
    if (sameWindow && previous.requestCount >= MAX_REQUESTS)
      throw new Error(
        "You have requested five codes within an hour. Please try again after the hourly window ends.",
      );
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(now.getTime() + TTL_MS);
    const data = {
      digest: digest(userId, code, now),
      expiresAt,
      attempts: 0,
      requestedAt: now,
      requestCount: sameWindow ? previous.requestCount + 1 : 1,
      windowStartedAt: sameWindow ? previous.windowStartedAt : now,
    };
    await tx.emailOtp.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
    await tx.emailMessage.updateMany({
      where: {
        key: { startsWith: `otp:${userId}:` },
        status: { in: ["QUEUED", "FAILED", "SENDING"] },
      },
      data: {
        status: "CANCELLED",
        lastError: "A newer verification code replaced this message.",
        body: "Superseded verification email; code removed.",
      },
    });
    await tx.emailMessage.create({
      data: {
        key: `otp:${userId}:${now.toISOString()}`,
        to: user.email,
        subject: "Your Skyline email verification code",
        body: `Your Skyline verification code is ${code}. It expires in 10 minutes. Only the latest code works. Do not share this code. If you did not request it, ignore this email.`,
      },
    });
    return {
      queued: true as const,
      expiresAt,
      emailKey: `otp:${userId}:${now.toISOString()}`,
    };
  });
}

export async function verifyEmailOtp(
  userId: string,
  code: string,
): Promise<void> {
  if (!/^\d{6}$/.test(code))
    throw new Error("Enter the six-digit code from your email.");
  secret();
  const result = await serializable(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.disabledAt) return "unavailable";
    if (user.emailVerifiedAt) return "verified";
    const otp = await tx.emailOtp.findUnique({ where: { userId } });
    if (!otp || otp.expiresAt <= new Date()) return "expired";
    if (otp.attempts >= MAX_ATTEMPTS) return "locked";
    const expected = Buffer.from(otp.digest, "hex");
    const actual = Buffer.from(digest(userId, code, otp.requestedAt), "hex");
    if (
      expected.length !== actual.length ||
      !timingSafeEqual(expected, actual)
    ) {
      await tx.emailOtp.update({
        where: { userId },
        data: { attempts: { increment: 1 } },
      });
      return otp.attempts + 1 >= MAX_ATTEMPTS ? "locked" : "invalid";
    }
    await tx.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });
    // Preserve hourly request limits while making this code unusable.
    await tx.emailOtp.update({
      where: { userId },
      data: { expiresAt: new Date(0), digest: "", attempts: MAX_ATTEMPTS },
    });
    await tx.emailMessage.updateMany({
      where: {
        key: { startsWith: `otp:${userId}:` },
        status: { in: ["QUEUED", "FAILED", "SENDING"] },
      },
      data: {
        status: "CANCELLED",
        lastError: "Email already verified.",
        body: "Email verified; code removed.",
      },
    });
    return "verified";
  });
  const messages = {
    unavailable: "This account is unavailable.",
    expired: "Your verification code has expired. Request a new code.",
    locked:
      "Five incorrect attempts were made. Request a new code when the resend cooldown ends.",
    invalid: "The verification code is incorrect. Check your latest email.",
  };
  if (result !== "verified") throw new Error(messages[result]);
}
