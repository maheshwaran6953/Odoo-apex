import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { hasClubAccess, type AccountAccess } from "@/lib/access";
import { csvResponse } from "@/lib/csv";

export const financeCategories = [
  "DUES",
  "TICKET",
  "MERCHANDISE",
  "FUNDRAISER",
  "REIMBURSEMENT",
  "OTHER",
] as const;
export const financeStatuses = [
  "posted",
  "pending",
  "rejected",
  "void",
  "test",
] as const;
export type FinanceFilters = {
  from: string;
  to: string;
  currency: string;
  category: string;
  status: string;
  type: string;
  q: string;
};
export function financeFilters(
  input: Record<string, string | string[] | undefined>,
): FinanceFilters {
  const field = (name: string) => {
    const value = input[name] ?? "";
    if (typeof value !== "string")
      throw Error("Each filter must have one value.");
    return value.trim();
  };
  const filters = {
    from: field("from"),
    to: field("to"),
    currency: field("currency"),
    category: field("category"),
    status: field("status"),
    type: field("type"),
    q: field("q"),
  };
  for (const value of [filters.from, filters.to]) {
    if (
      value &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
        new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value)
    )
      throw Error("Choose valid calendar dates.");
  }
  if (filters.from && filters.to && filters.from > filters.to)
    throw Error("From date must not be after To date.");
  if (
    (filters.currency && !["USD", "INR"].includes(filters.currency)) ||
    (filters.category &&
      !financeCategories.includes(
        filters.category as (typeof financeCategories)[number],
      )) ||
    (filters.status &&
      !financeStatuses.includes(
        filters.status as (typeof financeStatuses)[number],
      )) ||
    (filters.type && !["INCOME", "EXPENSE"].includes(filters.type)) ||
    filters.q.length > 100
  )
    throw Error(
      "Choose valid finance filters; search must be at most 100 characters.",
    );
  return filters;
}
export function financeWhere(f: FinanceFilters): Prisma.TransactionWhereInput {
  return {
    ...(f.currency ? { currency: f.currency } : {}),
    ...(f.category
      ? {
          category: f.category as
            | "DUES"
            | "TICKET"
            | "MERCHANDISE"
            | "FUNDRAISER"
            | "REIMBURSEMENT"
            | "OTHER",
        }
      : {}),
    ...(f.status ? { status: f.status } : {}),
    ...(f.type ? { type: f.type as "INCOME" | "EXPENSE" } : {}),
    ...(f.q ? { description: { contains: f.q } } : {}),
    ...(f.from || f.to
      ? {
          createdAt: {
            ...(f.from ? { gte: new Date(f.from + "T00:00:00Z") } : {}),
            ...(f.to
              ? { lt: new Date(Date.parse(f.to + "T00:00:00Z") + 86400000) }
              : {}),
          },
        }
      : {}),
  };
}
export async function exportFinance(
  actor: AccountAccess | null,
  input: Record<string, string | string[] | undefined>,
  database: PrismaClient = db,
) {
  if (!hasClubAccess(actor, ["TREASURER"]))
    return new Response("Treasurer access required.", { status: 403 });
  let filters: FinanceFilters;
  try {
    filters = financeFilters(input);
  } catch (error) {
    return new Response((error as Error).message, { status: 400 });
  }
  const rows = await database.transaction.findMany({
    where: financeWhere(filters),
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: 10001,
  });
  if (rows.length > 10000)
    return new Response("Narrow the filters to 10,000 entries or fewer.", {
      status: 400,
    });
  const ids = Array.from(
    new Set(
      rows.flatMap((r) =>
        [r.claimantId, r.reviewedById].filter((id): id is string => !!id),
      ),
    ),
  );
  const people = await database.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const names = new Map(
    people.map((p) => [p.id, p.name + " (" + p.email + ")"]),
  );
  return csvResponse(
    [
      [
        "ID",
        "Created at (UTC)",
        "Type",
        "Category",
        "Description",
        "Amount",
        "Currency",
        "Status",
        "Claimant",
        "Reviewer",
        "Reviewed at (UTC)",
        "Decision reason",
      ],
      ...rows.map((r) => [
        r.id,
        r.createdAt.toISOString(),
        r.type,
        r.category,
        r.description,
        (r.amountCents / 100).toFixed(2),
        r.currency,
        r.status,
        names.get(r.claimantId ?? "") ?? "",
        names.get(r.reviewedById ?? "") ?? "",
        r.reviewedAt?.toISOString() ?? "",
        r.decisionReason ?? "",
      ]),
    ],
    "skyline-finance.csv",
  );
}
