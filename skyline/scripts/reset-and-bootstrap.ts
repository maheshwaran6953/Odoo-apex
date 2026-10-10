import fs from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { PrismaClient, Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
loadEnvConfig(process.cwd());
const db = new PrismaClient();
async function main() {
  if (fs.existsSync("backups/reset-complete.json"))
    throw Error(
      "This reset already completed. It cannot be replayed. Create a new reviewed backup and maintenance procedure for any later reset.",
    );
  if (!process.argv.includes("--confirm-reset"))
    throw Error(
      "Explicit --confirm-reset required; this deletes all application data.",
    );
  const backup = fs.readFileSync("backups/last-backup-path.txt", "utf8");
  const snap = JSON.parse(fs.readFileSync(backup, "utf8"));
  if (!snap.tables || Object.keys(snap.tables).length < 19)
    throw Error("Verified full backup required.");
  const accounts = JSON.parse(
    fs.readFileSync("backups/bootstrap-accounts.json", "utf8"),
  );
  if (
    accounts.length !== 3 ||
    accounts.filter((a: any) => a.isRoleApprover && a.role === "STAFF")
      .length !== 1
  )
    throw Error("Exactly three accounts and one designated Staff required.");
  for (const a of accounts)
    if (
      !a.email ||
      a.password.length < 12 ||
      !["MEMBER", "STAFF", "TREASURER"].includes(a.role)
    )
      throw Error("Invalid bootstrap identity.");
  const models = Prisma.dmmf.datamodel.models.map((m) => m.name);
  await db.$transaction(
    async (tx) => {
      const list = models.map((m) => 'public."' + m + '"').join(",");
      await tx.$executeRawUnsafe(
        "TRUNCATE TABLE " + list + " RESTART IDENTITY CASCADE",
      );
      for (const a of accounts) {
        const user = await tx.user.create({
          data: {
            name: a.name,
            email: a.email.toLowerCase(),
            passwordHash: hashPassword(a.password),
            role: a.role,
            requestedRole: a.role,
            approvalStatus: "APPROVED",
            isRoleApprover: !!a.isRoleApprover,
            emailVerifiedAt: new Date(),
            approvedAt: new Date(),
            approvalReason:
              "Initial administrative bootstrap; email OTP not claimed.",
            emailReminders: false,
          },
        });
        if (a.role === "MEMBER") {
          const member = await tx.member.create({
            data: { name: a.name, email: a.email.toLowerCase() },
          });
          await tx.user.update({
            where: { id: user.id },
            data: { memberId: member.id },
          });
        }
      }
    },
    { timeout: 120000 },
  );
  fs.writeFileSync(
    "backups/reset-complete.json",
    JSON.stringify({ completedAt: new Date().toISOString() }),
    { flag: "wx" },
  );
  console.log(
    "Reset complete: three approved initial accounts, one member identity, no demo business data.",
  );
}
main()
  .catch((e) => {
    console.error("Reset failed:", e.code || e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
