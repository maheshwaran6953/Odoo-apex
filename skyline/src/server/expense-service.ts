import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { hasClubAccess } from "@/lib/access";
import { receiptLink } from "@/server/club-service";
import {
  receiptStorage,
  receiptMaxBytes,
  type ReceiptStorage,
} from "@/server/receipt-storage";

type ExpenseInput = {
  description: unknown;
  amountCents: unknown;
  currency: unknown;
  receiptUrl?: unknown;
  requestKey: unknown;
  file?: File | null;
};
export async function validateReceipt(file: File) {
  if (!file.size || file.size > receiptMaxBytes)
    throw Error("Receipt must be a nonempty PDF, PNG or JPEG up to 2 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let mime = "",
    extension = "";
  if (
    bytes.length >= 5 &&
    Buffer.from(bytes.slice(0, 5)).toString("ascii") === "%PDF-"
  ) {
    mime = "application/pdf";
    extension = "pdf";
  } else if (
    bytes.length >= 8 &&
    Buffer.from(bytes.slice(0, 8)).equals(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    )
  ) {
    mime = "image/png";
    extension = "png";
  } else if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    mime = "image/jpeg";
    extension = "jpg";
  }
  if (!mime || file.type !== mime)
    throw Error("Receipt content must match its PDF, PNG or JPEG file type.");
  const name =
    file.name.replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 120) ||
    "receipt." + extension;
  return {
    bytes,
    mime,
    extension,
    name,
    digest: createHash("sha256").update(bytes).digest("hex"),
  };
}
export async function submitExpense(
  actorId: string,
  input: ExpenseInput,
  database: PrismaClient = db,
  storage: ReceiptStorage = receiptStorage,
) {
  const actor = await database.user.findUnique({ where: { id: actorId } });
  if (!hasClubAccess(actor))
    throw Error("An approved, verified account is required.");
  const description =
    typeof input.description === "string" ? input.description.trim() : "";
  const receiptUrl = receiptLink(input.receiptUrl);
  const { amountCents, currency, requestKey } = input;
  if (
    description.length < 3 ||
    description.length > 200 ||
    /[\u0000-\u001f\u007f]/.test(description)
  )
    throw Error(
      "Describe the expense using 3-200 characters without control characters.",
    );
  if (
    typeof amountCents !== "number" ||
    !Number.isSafeInteger(amountCents) ||
    amountCents < 1 ||
    amountCents > 10_000_000 ||
    typeof currency !== "string" ||
    !["USD", "INR"].includes(currency)
  )
    throw Error(
      "Choose USD or INR and a positive amount up to 100,000 with at most two decimal places.",
    );
  if (typeof requestKey !== "string" || !/^[a-f0-9-]{36}$/.test(requestKey))
    throw Error("Refresh the expense form before submitting.");
  if (receiptUrl === undefined)
    throw Error(
      "Use a valid HTTPS receipt link without credentials, or leave it empty.",
    );
  if (input.file && receiptUrl)
    throw Error("Choose either a private file or an HTTPS link, not both.");
  const receipt = input.file ? await validateReceipt(input.file) : null;
  const key = actorId + ":" + requestKey;
  const hash = createHash("sha256")
    .update(
      JSON.stringify({
        description,
        amountCents,
        currency,
        receiptUrl,
        file: receipt?.digest ?? null,
        name: receipt?.name ?? null,
      }),
    )
    .digest("hex");
  const duplicate = (prior: { requestHash: string | null }) => {
    if (prior.requestHash !== hash)
      throw Error(
        "This submission was already used for a different expense. Refresh.",
      );
    return {
      ok: true,
      message: "Expense already submitted; no duplicate request was created.",
    };
  };
  const prior = await database.transaction.findUnique({
    where: { requestKey: key },
  });
  if (prior) return duplicate(prior);
  const path = receipt
    ? actorId + "/" + randomUUID() + "." + receipt.extension
    : null;
  if (receipt && path) await storage.upload(path, receipt.bytes, receipt.mime);
  try {
    await database.$transaction(async (tx) => {
      const current = await tx.user.findUnique({ where: { id: actorId } });
      if (!hasClubAccess(current))
        throw Error(
          "Your account access changed. Expense submission was blocked.",
        );
      await tx.transaction.create({
        data: {
          type: "EXPENSE",
          category: "REIMBURSEMENT",
          description,
          amountCents,
          currency,
          claimantId: actorId,
          receiptUrl,
          status: "pending",
          receiptPath: path,
          receiptName: receipt?.name,
          receiptMime: receipt?.mime,
          receiptBytes: receipt?.bytes.length,
          requestKey: key,
          requestHash: hash,
        },
      });
    });
  } catch (error) {
    // On an ambiguous database response, preserve any object until the winning
    // record can be checked. Never delete a receipt already linked to a claim.
    const winner = await database.transaction.findUnique({
      where: { requestKey: key },
    });
    if (path && winner?.receiptPath !== path) await storage.remove(path);
    if (winner) return duplicate(winner);
    if (error instanceof Prisma.PrismaClientKnownRequestError)
      throw Error("Could not save the expense. Refresh and retry.");
    throw error;
  }
  return {
    ok: true,
    message: "Expense submitted for review. No money has been transferred.",
  };
}
export async function downloadExpenseReceipt(
  actorId: string,
  expenseId: string,
  database: PrismaClient = db,
  storage: ReceiptStorage = receiptStorage,
) {
  const actor = await database.user.findUnique({ where: { id: actorId } });
  if (!hasClubAccess(actor))
    return new Response("Access denied.", { status: 403 });
  if (!expenseId || expenseId.length > 100)
    return new Response("Receipt unavailable.", { status: 404 });
  const expense = await database.transaction.findUnique({
    where: { id: expenseId },
  });
  if (
    !expense?.receiptPath ||
    !expense.receiptMime ||
    !expense.receiptName ||
    (actor.id !== expense.claimantId && actor.role !== "TREASURER")
  )
    return new Response("Receipt unavailable.", { status: 404 });
  try {
    const blob = await storage.download(expense.receiptPath);
    return new Response(blob, {
      headers: {
        "Content-Type": expense.receiptMime,
        "Content-Disposition":
          'attachment; filename="' +
          expense.receiptName.replace(/["\\\r\n]/g, "_") +
          '"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch {
    return new Response("Receipt temporarily unavailable. Please retry.", {
      status: 503,
    });
  }
}
