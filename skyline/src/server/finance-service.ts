import type { PrismaClient, Transaction } from "@prisma/client";
import { db } from "@/lib/db";

export function parseExpenseAmount(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{1,6}(\.\d{1,2})?$/.test(value.trim()))
    return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 10_000_000
    ? cents
    : null;
}

export function financeSummary(
  transactions: Pick<
    Transaction,
    "currency" | "type" | "status" | "amountCents"
  >[],
  currency: string,
) {
  const entries = transactions.filter((entry) => entry.currency === currency);
  const income = entries
    .filter((entry) => entry.type === "INCOME" && entry.status === "posted")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const expenses = entries
    .filter((entry) => entry.type === "EXPENSE" && entry.status === "posted")
    .reduce((sum, entry) => sum + entry.amountCents, 0);
  const pending = entries.filter(
    (entry) => entry.type === "EXPENSE" && entry.status === "pending",
  );
  return {
    income,
    expenses,
    balance: income - expenses,
    pendingCount: pending.length,
    pendingAmount: pending.reduce((sum, entry) => sum + entry.amountCents, 0),
  };
}

export async function reviewExpenseRecord(
  actorId: string,
  id: string,
  decision: "posted" | "rejected",
  reason?: string,
  database: PrismaClient = db,
) {
  if (
    typeof id !== "string" ||
    !id ||
    id.length > 100 ||
    !["posted", "rejected"].includes(decision)
  )
    return { ok: false, message: "Invalid expense request." };
  const trimmedReason = typeof reason === "string" ? reason.trim() : "";
  if (
    decision === "rejected" &&
    (trimmedReason.length < 3 ||
      trimmedReason.length > 300 ||
      /[\u0000-\u001f\u007f]/.test(trimmedReason))
  )
    return {
      ok: false,
      message: "Enter a rejection reason using 3–300 characters.",
    };
  return database.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (
      !actor ||
      actor.role !== "TREASURER" ||
      actor.approvalStatus !== "APPROVED" ||
      !actor.emailVerifiedAt ||
      actor.disabledAt
    )
      return {
        ok: false,
        message: "Only an approved, verified Treasurer can review expenses.",
      };
    const request = await tx.transaction.findUnique({ where: { id } });
    if (
      !request ||
      request.type !== "EXPENSE" ||
      request.category !== "REIMBURSEMENT" ||
      request.status !== "pending"
    )
      return {
        ok: false,
        message: "This request has already been reviewed or is unavailable.",
      };
    if (
      !Number.isSafeInteger(request.amountCents) ||
      request.amountCents <= 0 ||
      request.amountCents > 10_000_000 ||
      !["USD", "INR"].includes(request.currency)
    )
      return {
        ok: false,
        message: "This request has an invalid amount or currency.",
      };
    if (!request.claimantId)
      return {
        ok: false,
        message:
          "This request has no recorded claimant and cannot be reviewed.",
      };
    if (request.claimantId === actor.id)
      return {
        ok: false,
        message: "You cannot review your own reimbursement request.",
      };
    const updated = await tx.transaction.updateMany({
      where: {
        id,
        type: "EXPENSE",
        category: "REIMBURSEMENT",
        status: "pending",
        claimantId: request.claimantId,
      },
      data: {
        status: decision,
        reviewedById: actor.id,
        reviewedAt: new Date(),
        decisionReason: decision === "rejected" ? trimmedReason : null,
      },
    });
    if (updated.count !== 1)
      return {
        ok: false,
        message:
          "Another reviewer already decided this request. Refresh the page.",
      };
    return {
      ok: true,
      message:
        decision === "posted"
          ? "Expense approved and posted to the ledger. Arrange reimbursement separately."
          : "Expense rejected. The club balance has not changed.",
    };
  });
}
