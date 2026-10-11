"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { merchandiseOrderSchema } from "@/lib/validators";
import { requireRole, requireUser } from "@/server/auth";
import { orderClubMerchandise, fulfillClubOrder } from "@/server/club-service";
export async function createMerchandiseOrder(input: unknown) {
  await requireRole(["MEMBER", "STAFF"]);
  const actor = await requireUser();
  if (input instanceof FormData)
    input = { itemId: input.get("itemId"), quantity: input.get("quantity") };
  const parsed = merchandiseOrderSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      message: "Choose a product and a whole quantity from 1 to 10.",
    };
  try {
    const result = await orderClubMerchandise(
      actor.id,
      parsed.data.itemId,
      parsed.data.quantity,
    );
    for (const path of ["/merchandise", "/treasurer", "/"])
      revalidatePath(path);
    return result;
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && !error.name.startsWith("Prisma")
          ? error.message
          : "Unable to place this order. Refresh and try again.",
    };
  }
}
export async function fulfillMerchandiseOrder(orderId: string) {
  await requireRole(["STAFF"]);
  const actor = await requireUser();
  if (typeof orderId !== "string" || !orderId)
    return { ok: false, message: "Choose an order." };
  try {
    const result = await fulfillClubOrder(actor.id, orderId);
    revalidatePath("/merchandise");
    revalidatePath("/notifications");
    return result;
  } catch {
    return {
      ok: false,
      message: "Unable to record collection. Refresh and try again.",
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
  const memberPriceText = String(form.get("memberPrice") || "").trim();
  const memberPriceCents = memberPriceText
    ? moneyCents(memberPriceText, true)
    : null;
  if (
    !String(form.get("category") || "").trim() ||
    String(form.get("category") || "").trim().length > 60 ||
    !validName(name) ||
    size.length > 20 ||
    !/^\d{1,7}$/.test(stockText) ||
    Number(stockText) > 1000000 ||
    priceCents === null ||
    (memberPriceText !== "" &&
      (memberPriceCents === null || memberPriceCents > priceCents))
  )
    return {
      ok: false,
      message:
        "Enter a name, optional size, nonnegative whole stock up to 1,000,000 and a valid USD price. An optional member price must not exceed the regular price.",
    };
  await db.inventoryItem.create({
    data: {
      name,
      category: String(form.get("category") || "").trim(),
      size: size || null,
      stock: Number(stockText),
      priceCents,
      memberPriceCents,
    },
  });
  const { revalidatePath } = await import("next/cache");
  revalidatePath("/merchandise");
  return { ok: true, message: "Inventory item added." };
}
