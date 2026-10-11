"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/server/auth";
import { receiptLink, recordFundraiserIncome } from "@/server/club-service";

import {
  parseExpenseAmount,
  reviewExpenseRecord,
} from "@/server/finance-service";

export async function createExpense(input: unknown) {
  await requireRole(["MEMBER", "STAFF", "TREASURER"]);
  const user = await requireUser();
  const data =
    input instanceof FormData
      ? {
          description: input.get("description"),
          amountCents: parseExpenseAmount(input.get("amount")),
          currency: input.get("currency"),
          receiptUrl: input.get("receiptUrl"),
        }
      : input && typeof input === "object"
        ? (input as {
            description?: unknown;
            amountCents?: unknown;
            currency?: unknown;
            receiptUrl?: unknown;
          })
        : {};
  const description =
    typeof data.description === "string" ? data.description.trim() : "";
  const currency = data.currency ?? "USD";
  const receiptUrl = receiptLink(data.receiptUrl);
  if (receiptUrl === undefined)
    return {
      ok: false,
      message:
        "Use an HTTPS receipt link up to 2,000 characters without embedded credentials, or leave it empty.",
    };
  if (
    description.length < 3 ||
    description.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(description)
  ) {
    return {
      ok: false,
      message:
        "Describe the expense using 3–200 characters without control characters.",
    };
  }
  if (
    typeof data.amountCents !== "number" ||
    !Number.isSafeInteger(data.amountCents) ||
    data.amountCents < 1 ||
    data.amountCents > 10_000_000 ||
    typeof currency !== "string" ||
    !["USD", "INR"].includes(currency)
  ) {
    return {
      ok: false,
      message:
        "Choose USD or INR and enter a positive amount up to 100,000 with at most two decimal places.",
    };
  }
  await db.transaction.create({
    data: {
      type: "EXPENSE",
      category: "REIMBURSEMENT",
      description,
      amountCents: data.amountCents,
      currency: String(currency),
      claimantId: user.id,
      receiptUrl,
      status: "pending",
    },
  });
  revalidatePath("/account");
  revalidatePath("/treasurer");
  return {
    ok: true,
    message: "Expense submitted for review. No money has been transferred.",
  };
}

async function reviewExpense(
  id: string,
  decision: "posted" | "rejected",
  reason?: string,
) {
  await requireRole(["TREASURER"]);
  const user = await requireUser();
  const result = await reviewExpenseRecord(user.id, id, decision, reason);
  if (!result.ok) return result;
  revalidatePath("/account");
  revalidatePath("/treasurer");
  revalidatePath("/");
  return result;
}

export async function approveExpense(id: string) {
  return reviewExpense(id, "posted");
}

export async function rejectExpense(id: string, form: FormData) {
  const value = form.get("reason");
  const reason = typeof value === "string" ? value.trim() : "";
  if (
    reason.length < 3 ||
    reason.length > 300 ||
    /[\u0000-\u001f\u007f]/.test(reason)
  )
    return {
      ok: false,
      message: "Enter a rejection reason using 3–300 characters.",
    };
  return reviewExpense(id, "rejected", reason);
}

export async function createFundraiserIncome(form: FormData) {
  await requireRole(["TREASURER"]);
  const user = await requireUser();
  const amountCents = parseExpenseAmount(form.get("amount"));
  if (amountCents === null)
    return {
      ok: false,
      message:
        "Enter a positive amount up to 100,000 with at most two decimals.",
    };
  try {
    const result = await recordFundraiserIncome(
      user.id,
      String(form.get("description") || "").trim(),
      amountCents,
      String(form.get("currency") || ""),
      String(form.get("requestKey") || ""),
    );
    revalidatePath("/treasurer");
    revalidatePath("/");
    return result;
  } catch {
    return {
      ok: false,
      message:
        "Could not record fundraiser receipts. Check the description, currency and amount; refresh if already submitted.",
    };
  }
}
