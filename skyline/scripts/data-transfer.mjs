import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { appRoot } from "./database.mjs";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();
const models = [
  "member",
  "membership",
  "user",
  "event",
  "inventoryItem",
  "transaction",
  "ticket",
  "merchandiseOrder",
  "merchandiseOrderLine",
  "task",
  "announcement",
  "waitlistEntry",
  "notification",
  "emailMessage",
  "payment",
  "paymentWebhook",
];
const dateFields = [
  "createdAt",
  "updatedAt",
  "expiresAt",
  "startsAt",
  "registrationClosesAt",
  "cancelledAt",
  "checkedInAt",
  "reminderAt",
  "dueAt",
  "publishedAt",
  "emailVerifiedAt",
  "disabledAt",
  "offeredAt",
  "offerExpiresAt",
  "readAt",
  "sentAt",
  "claimedAt",
  "capturedAt",
  "refundedAt",
  "lastCheckedAt",
  "processedAt",
];
async function main() {
  const [command, requestedPath] = process.argv.slice(2);
  const file = path.resolve(
    appRoot,
    requestedPath || "backups/skyline-transfer.json",
  );
  if (command === "export") {
    const tables = await db.$transaction(async (tx) => {
      const data = {};
      for (const model of models) data[model] = await tx[model].findMany();
      return data;
    });
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      JSON.stringify(
        { version: 2, exportedAt: new Date().toISOString(), tables },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Private snapshot saved. It contains personal records and password hashes. Keep it out of Git.",
    );
  } else if (command === "import") {
    if (process.env.DATABASE_PROVIDER !== "postgresql")
      throw new Error(
        "Import must run against the target PostgreSQL database.",
      );
    const snapshot = JSON.parse(readFileSync(file, "utf8"));
    if (snapshot.version === 1) { snapshot.tables.payment = []; snapshot.tables.paymentWebhook = []; }
    if (
      ![1, 2].includes(snapshot.version) ||
      models.some((model) => !Array.isArray(snapshot.tables?.[model]))
    )
      throw new Error("Invalid snapshot.");
    await db.$transaction(
      async (tx) => {
        for (const model of models)
          if (await tx[model].count())
            throw new Error(
              "Target is not empty. Import stopped without replacing records.",
            );
        for (const model of models) {
          const data = snapshot.tables[model].map((row) =>
            Object.fromEntries(
              Object.entries(row).map(([key, value]) => [
                key,
                value && dateFields.includes(key) ? new Date(value) : value,
              ]),
            ),
          );
          if (data.length) await tx[model].createMany({ data });
        }
      },
      { timeout: 120000 },
    );
    console.log(
      "Records imported with IDs and relationships preserved. Sessions and verification/reset tokens were intentionally not transferred; users must sign in again.",
    );
  } else throw new Error("Use npm run db:export or npm run db:import.");
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
