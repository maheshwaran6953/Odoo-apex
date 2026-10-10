'use server';

import { db } from '@/lib/db';
import { merchandiseOrderSchema } from '@/lib/validators';
import { requireRole } from '@/server/auth';
export async function createMerchandiseOrder(input: unknown) { await requireRole(['MEMBER', 'STAFF']); if (input instanceof FormData)
    input = { itemId: input.get('itemId'), quantity: input.get('quantity') ?? 1, memberId: input.get('memberId') || undefined }; const parsed = merchandiseOrderSchema.safeParse(input); if (!parsed.success)
    return { ok: false, message: 'Choose a product and a whole-number quantity.' }; const { itemId, quantity, memberId } = parsed.data; try {
    await db.$transaction(async (tx) => { const item = await tx.inventoryItem.findUnique({ where: { id: itemId } }); if (!item)
        throw new Error('This product is no longer available.'); const updated = await tx.inventoryItem.updateMany({ where: { id: itemId, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } }); if (updated.count !== 1)
        throw new Error(`Only ${item.stock} available in this size. Please adjust your quantity.`); const totalCents = item.priceCents * quantity; const order = await tx.merchandiseOrder.create({ data: { memberId, status: 'PAID', totalCents, lines: { create: { itemId, quantity, unitPriceCents: item.priceCents } } } }); await tx.transaction.create({ data: { type: 'INCOME', category: 'MERCHANDISE', description: `${quantity} × ${item.name} (${item.size ?? 'One size'}) · ${order.id.slice(-6)}`, amountCents: totalCents, memberId } }); });
    
    return { ok: true, message: 'Club order recorded. Stock and ledger are updated.' };
}
catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to place your order.' };
} }

