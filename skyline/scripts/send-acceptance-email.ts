import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const to = process.argv[process.argv.indexOf("--to") + 1];
  if (
    !process.argv.includes("--send") ||
    !process.argv.includes("--to") ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to ?? "")
  )
    throw Error(
      "Use --send --to <explicitly authorized recipient>. This sends one real email.",
    );
  const { db } = await import("../src/lib/db");
  const { deliverQueuedEmail } = await import("../src/server/email");
  const key = "acceptance:" + randomUUID();
  try {
    await db.emailMessage.create({
      data: {
        key,
        to,
        subject: "Skyline — email delivery check",
        body: "This is the email delivery check you requested for Skyline Student Organization System. No password or OTP is included. Please confirm receipt in the Codex chat. This message verifies delivery only; it does not change account verification, approval or preferences.",
      },
    });
    const result = await deliverQueuedEmail({ key });
    const message = await db.emailMessage.findUnique({
      where: { key },
      select: { status: true },
    });
    console.log(
      "Targeted acceptance email status:",
      message?.status,
      "sent:",
      result.sent,
      "failed:",
      result.failed,
    );
    if (result.sent !== 1)
      throw Error(
        "Delivery was not confirmed. Review application email status before retrying.",
      );
    console.log(
      "SMTP acceptance recorded. Inbox receipt still requires the recipient's confirmation. Other queued emails were not dispatched.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Targeted email check failed. Check SMTP configuration and email status; secrets were not printed.",
  );
  process.exitCode = 1;
});
