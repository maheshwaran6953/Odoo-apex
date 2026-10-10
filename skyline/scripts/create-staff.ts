import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
loadEnvConfig(process.cwd());
const db = new PrismaClient();
async function main() {
  const email = process.env.BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_PASSWORD;
  const name = process.env.BOOTSTRAP_NAME?.trim();
  if (
    !email ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !name ||
    !password ||
    password.length < 12 ||
    password.length > 256
  )
    throw new Error(
      "Set BOOTSTRAP_EMAIL, BOOTSTRAP_NAME and a 12–256 character BOOTSTRAP_PASSWORD locally.",
    );
  if (await db.user.count({ where: { role: "STAFF", disabledAt: null } }))
    throw new Error(
      "A staff account already exists. Use User access instead of bootstrapping again.",
    );
  if (await db.user.findUnique({ where: { email } }))
    throw new Error(
      "That email already has an account. Do not silently promote an existing user.",
    );
  await db.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
      role: "STAFF",
      requestedRole: "STAFF",
      approvalStatus: "APPROVED",
      isRoleApprover: true,
      approvedAt: new Date(),
      approvalReason: "Initial administrative bootstrap",
      emailVerifiedAt: new Date(),
    },
  });
  console.log(
    "First staff account created. Remove the bootstrap password from .env and sign in.",
  );
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
