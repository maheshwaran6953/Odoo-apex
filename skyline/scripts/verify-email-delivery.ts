import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { loadEnvConfig } from "@next/env";
async function main() {
  if (!process.argv.includes("--temporary-fixtures"))
    throw Error("Temporary fixture opt-in required.");
  loadEnvConfig(process.cwd());
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "fixture@skyline.example";
  process.env.SMTP_PASSWORD = "fixture-not-real-credentials";
  process.env.EMAIL_FROM = "fixture@skyline.example";
  process.env.EMAIL_VERIFICATION_ENABLED = "true";
  process.env.OTP_SECRET = randomBytes(32).toString("hex");
  const { db } = await import("../src/lib/db");
  const { emailConfigurationError, EmailTransportError } =
    await import("../src/server/email-transport");
  const { deliverQueuedEmail } = await import("../src/server/email");
  const { issueEmailOtp } = await import("../src/server/otp-service");
  const id = "mail-fixture-" + randomBytes(12).toString("hex");
  let calls = 0;
  const accepted = async () => {
    calls++;
    return "fixture-accepted";
  };
  const existing = await db.emailMessage.count();
  try {
    assert.equal(emailConfigurationError(), null);
    process.env.SMTP_SECURE = "false";
    assert.match(emailConfigurationError() || "", /SMTP_SECURE/);
    process.env.SMTP_SECURE = "true";
    process.env.EMAIL_FROM = "other@skyline.example";
    assert.match(emailConfigurationError() || "", /match/);
    process.env.EMAIL_FROM = process.env.SMTP_USER;
    await db.user.create({
      data: {
        id,
        name: "Temporary email fixture",
        email: id + "@skyline.example",
        passwordHash: "not-a-login-hash",
      },
    });
    const otp = await issueEmailOtp(id);
    const races = await Promise.all([
      deliverQueuedEmail({ key: otp.emailKey }, accepted),
      deliverQueuedEmail({ key: otp.emailKey }, accepted),
    ]);
    assert.equal(calls, 1);
    assert.equal(
      races.reduce((n, r) => n + r.sent, 0),
      1,
    );
    const sent = await db.emailMessage.findUniqueOrThrow({
      where: { key: otp.emailKey },
    });
    assert.equal(sent.status, "SENT");
    assert.ok(!/code is \d{6}/.test(sent.body));
    const key = id + ":retry";
    await db.emailMessage.create({
      data: {
        key,
        to: id + "@skyline.example",
        subject: "fixture",
        body: "fixture",
      },
    });
    await deliverQueuedEmail({ key }, async () => {
      throw new EmailTransportError("SMTP authentication failed.", true);
    });
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { key } })).status,
      "FAILED",
    );
    await deliverQueuedEmail({ key }, accepted);
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { key } })).status,
      "SENT",
    );
    const uncertain = id + ":uncertain";
    await db.emailMessage.create({
      data: {
        key: uncertain,
        to: id + "@skyline.example",
        subject: "fixture",
        body: "fixture",
      },
    });
    await deliverQueuedEmail({ key: uncertain }, async () => {
      throw new EmailTransportError("Delivery uncertain.", false);
    });
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { key: uncertain } }))
        .status,
      "REVIEW",
    );
    const before = calls;
    await deliverQueuedEmail({ key: uncertain }, accepted);
    assert.equal(calls, before);
    const stale = id + ":stale";
    await db.emailMessage.create({
      data: {
        key: stale,
        to: id + "@skyline.example",
        subject: "fixture",
        body: "fixture",
        status: "SENDING",
        attempts: 1,
        claimedAt: new Date(Date.now() - 360000),
      },
    });
    await deliverQueuedEmail({ key: stale }, accepted);
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { key: stale } }))
        .status,
      "REVIEW",
    );
    assert.equal(calls, before);
    await db.emailOtp.update({
      where: { userId: id },
      data: { requestedAt: new Date(Date.now() - 61000) },
    });
    const expired = await issueEmailOtp(id);
    await db.emailOtp.update({
      where: { userId: id },
      data: { expiresAt: new Date(0) },
    });
    await deliverQueuedEmail({ key: expired.emailKey }, accepted);
    assert.equal(
      (
        await db.emailMessage.findUniqueOrThrow({
          where: { key: expired.emailKey },
        })
      ).status,
      "CANCELLED",
    );
    assert.equal(calls, before);
    console.log(
      "Email queue checks passed: encrypted config validation, one concurrent dispatch, OTP scrub, safe rejected retry, ambiguous/stale SMTP review, expired code cancellation. Provider delivery simulated; no emails sent.",
    );
  } finally {
    await db.emailMessage.deleteMany({
      where: {
        OR: [
          { key: { startsWith: id + ":" } },
          { key: { startsWith: "otp:" + id + ":" } },
        ],
      },
    });
    await db.emailOtp.deleteMany({ where: { userId: id } });
    await db.user.deleteMany({ where: { id } });
    assert.equal(await db.emailMessage.count(), existing);
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    "Email fixture verification failed:",
    error?.code || error?.message,
  );
  process.exitCode = 1;
});
