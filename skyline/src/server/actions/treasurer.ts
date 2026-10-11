"use server";

import { revalidatePath } from "next/cache";
import { submitExpense } from "@/server/expense-service";
import { requireRole, requireUser } from "@/server/auth";
import { recordFundraiserIncome } from "@/server/club-service";

import {
  parseExpenseAmount,
  reviewExpenseRecord,
} from "@/server/finance-service";

export async function createExpense(input: unknown) {
  const user = await requireUser();
  if (!(input instanceof FormData))
    return { ok: false, message: "Submit the expense using the form." };
  const rawFile = input.get("receiptFile");
  if (typeof rawFile === "string" && rawFile.trim())
    return {
      ok: false,
      message: "Choose the receipt using the file selector.",
    };
  const file =
    rawFile && typeof rawFile !== "string" && (rawFile.name || rawFile.size > 0)
      ? rawFile
      : null;
  try {
    const result = await submitExpense(user.id, {
      description: input.get("description"),
      amountCents: parseExpenseAmount(input.get("amount")),
      currency: input.get("currency"),
      receiptUrl: input.get("receiptUrl"),
      requestKey: input.get("requestKey"),
      file,
    });
    revalidatePath("/account");
    revalidatePath("/treasurer");
    return result;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not submit this expense. Try again.",
    };
  }
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
