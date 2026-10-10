import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function main() {
  const { processEventUpdates } = await import("../src/server/events-service");
  const { deliverQueuedEmail } = await import("../src/server/email");
  const { processPaymentUpdates } = await import("../src/server/payments-service");
  do {
    try {
      await processPaymentUpdates();
      await processEventUpdates();
      const email = await deliverQueuedEmail();
      console.log(
        `${new Date().toISOString()} Event jobs complete. Email: ${email.configured ? `${email.sent} sent, ${email.failed} failed` : "not configured; messages remain queued"}.`,
      );
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Event job failed.",
      );
      if (!process.argv.includes("--watch")) process.exitCode = 1;
    }
    if (!process.argv.includes("--watch")) break;
    await new Promise((resolve) => setTimeout(resolve, 5 * 60000));
  } while (true);
  const { db } = await import("../src/lib/db");
  await db.$disconnect();
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
