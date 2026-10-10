"use server";

import { db } from "@/lib/db";
import { merchandiseOrderSchema } from "@/lib/validators";
import { requireRole, requireUser } from "@/server/auth";
export async function createMerchandiseOrder(input: unknown) {
  await requireRole(["MEMBER", "STAFF"]);
  const actor = await requireUser();
  if (input instanceof FormData)
    input = {
      itemId: input.get("itemId"),
      quantity: input.get("quantity") ?? 1,
      memberId: input.get("memberId") || undefined,
    };
  const parsed = merchandiseOrderSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Choose a product and a whole-number quantity.",
    };
  const { itemId, quantity } = parsed.data;
  const memberId = actor.memberId ?? undefined;
  try {
    await db.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: itemId } });
      if (!item) throw new Error("This product is no longer available.");
      const updated = await tx.inventoryItem.updateMany({
        where: { id: itemId, stock: { gte: quantity } },
        data: { stock: { decrement: quantity } },
      });
      if (updated.count !== 1)
        throw new Error(
          `Only ${item.stock} available in this size. Please adjust your quantity.`,
        );
      const totalCents = item.priceCents * quantity;
      if (
        !Number.isSafeInteger(totalCents) ||
        totalCents < 0 ||
        totalCents > 2147483647
      )
        throw new Error(
          "This product price cannot be processed. Contact staff.",
        );
      const order = await tx.merchandiseOrder.create({
        data: {
          userId: actor.id,
          memberId,
          status: "PAID",
          totalCents,
          lines: {
            create: { itemId, quantity, unitPriceCents: item.priceCents },
          },
        },
      });
      await tx.transaction.create({
        data: {
          type: "INCOME",
          category: "MERCHANDISE",
          description: `${quantity} × ${item.name} (${item.size ?? "One size"}) · ${order.id.slice(-6)}`,
          amountCents: totalCents,
          memberId,
        },
      });
    });

    return {
      ok: true,
      message: "Club order recorded. Stock and ledger are updated.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && !error.name.startsWith("Prisma")
          ? error.message
          : "Unable to place your order.",
    };
  }
}

export async function addInventoryItem(form: FormData) {
  await requireRole(["STAFF"]);
  const name = String(form.get("name") || "").trim(),
    size = String(form.get("size") || "").trim(),
    stockText = String(form.get("stock") || ""),
    priceText = String(form.get("price") || "");
  const { moneyCents, validName } = await import("@/lib/validation");
  const priceCents = moneyCents(priceText, true);
  if (
    !String(form.get("category") || "").trim() ||
    String(form.get("category") || "").trim().length > 60 ||
    !validName(name) ||
    size.length > 20 ||
    !/^\d{1,7}$/.test(stockText) ||
    Number(stockText) > 1000000 ||
    priceCents === null
  )
    return {
      ok: false,
      message:
        "Enter a name, optional size, nonnegative whole stock up to 1,000,000 and a valid USD price.",
    };
  await db.inventoryItem.create({
    data: {
      name,
      category: String(form.get("category") || "").trim(),
      size: size || null,
      stock: Number(stockText),
      priceCents,
    },
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/merchandise");
  return { ok: true, message: "Inventory item added." };
}
