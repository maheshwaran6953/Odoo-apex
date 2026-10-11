import { PrismaClient } from "@prisma/client";
import { boundedDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const datasourceUrl = boundedDatabaseUrl();
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ ...(datasourceUrl ? { datasourceUrl } : {}) });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
