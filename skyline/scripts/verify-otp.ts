import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

async function main() {
  if (!process.argv.includes("--temporary-fixtures"))
    throw new Error(
      "Pass --temporary-fixtures to permit isolated test records.",
    );
  loadEnvConfig(process.cwd());
  process.env.OTP_SECRET = randomBytes(32).toString("hex");
  process.env.EMAIL_VERIFICATION_ENABLED = "true";
  process.env.RESEND_API_KEY = "fixture-no-network";
  process.env.EMAIL_FROM = "fixture@skyline.example";
  // No worker or provider is invoked. Test codes are read only from isolated fixture outbox rows.
  const { db } = await import("../src/lib/db");
  const { issueEmailOtp, verifyEmailOtp } =
    await import("../src/server/otp-service");
  const id = `otp-fixture-${randomBytes(12).toString("hex")}`;
  try {
    await db.user.create({
      data: {
        id,
        name: "Temporary OTP fixture",
        email: `${id}@skyline.example`,
        passwordHash: "not-a-login-hash",
      },
    });
    process.env.EMAIL_VERIFICATION_ENABLED = "false";
    await assert.rejects(issueEmailOtp(id), /not configured/);
    assert.equal(await db.emailOtp.count({ where: { userId: id } }), 0);
    process.env.EMAIL_VERIFICATION_ENABLED = "true";
    const issuance = await Promise.allSettled([
      issueEmailOtp(id),
      issueEmailOtp(id),
    ]);
    assert.equal(issuance.filter((r) => r.status === "fulfilled").length, 1);
    const mail = await db.emailMessage.findFirstOrThrow({
      where: { key: { startsWith: `otp:${id}:` } },
    });
    const code = mail.body.match(/code is (\d{6})/)?.[1];
    assert.ok(code);
    await assert.rejects(issueEmailOtp(id), /60 seconds/);
    await assert.rejects(verifyEmailOtp(id, "12345"), /six-digit/);
    assert.equal(
      (await db.emailOtp.findUniqueOrThrow({ where: { userId: id } })).attempts,
      0,
    );
    const wrong = code === "999999" ? "888888" : "999999";
    for (let n = 0; n < 5; n++)
      await assert.rejects(
        verifyEmailOtp(id, wrong),
        n === 4 ? /Five incorrect/ : /incorrect/,
      );
    await assert.rejects(verifyEmailOtp(id, code), /Five incorrect/);
    await db.emailOtp.update({
      where: { userId: id },
      data: { requestedAt: new Date(Date.now() - 61_000) },
    });
    await issueEmailOtp(id);
    assert.equal(
      (await db.emailMessage.findUniqueOrThrow({ where: { id: mail.id } }))
        .status,
      "CANCELLED",
    );
    await db.emailOtp.update({
      where: { userId: id },
      data: { expiresAt: new Date(0) },
    });
    await assert.rejects(verifyEmailOtp(id, code), /expired/);
    // Test leading zeros and simultaneous consumption with a deliberately isolated fixture digest.
    const requestedAt = new Date();
    const leadingCode = "000123";
    const digest = createHmac("sha256", process.env.OTP_SECRET)
      .update(`${id}:${requestedAt.toISOString()}:${leadingCode}`)
      .digest("hex");
    await db.emailOtp.update({
      where: { userId: id },
      data: {
        requestedAt,
        digest,
        expiresAt: new Date(Date.now() + 600_000),
        attempts: 0,
      },
    });
    await Promise.all([
      verifyEmailOtp(id, leadingCode),
      verifyEmailOtp(id, leadingCode),
    ]);
    assert.ok(
      (await db.user.findUniqueOrThrow({ where: { id } })).emailVerifiedAt,
    );
    assert.equal(
      (await db.emailOtp.findUniqueOrThrow({ where: { userId: id } })).digest,
      "",
    );
    await db.user.update({ where: { id }, data: { emailVerifiedAt: null } });
    await db.emailOtp.update({
      where: { userId: id },
      data: {
        requestedAt: new Date(Date.now() - 61_000),
        requestCount: 5,
        windowStartedAt: new Date(),
      },
    });
    await assert.rejects(issueEmailOtp(id), /five codes/);
    console.log(
      "OTP checks passed: disabled delivery, concurrent issuance, cooldown, malformed input, attempts, supersession, expiry, leading zeros, concurrent consumption, hourly limit. No provider email sent.",
    );
  } finally {
    await db.emailMessage.deleteMany({
      where: { key: { startsWith: `otp:${id}:` } },
    });
    await db.emailOtp.deleteMany({ where: { userId: id } });
    await db.user.deleteMany({ where: { id } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "OTP verification failed.",
  );
  process.exitCode = 1;
});
