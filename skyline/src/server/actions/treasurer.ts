'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/server/auth';
export async function createExpense(input: unknown) { await requireRole(['MEMBER', 'STAFF', 'TREASURER']); const data = input instanceof FormData ? { description: input.get('description'), amountCents: input.has('amount') ? Math.round(Number(input.get('amount')) * 100) : Number(input.get('amountCents')) } : input as {
    description?: string;
    amountCents?: number;
}; if (typeof data.description !== 'string' || data.description.trim().length < 3 || data.description.length > 200 || !Number.isInteger(data.amountCents) || Number(data.amountCents) <= 0 || Number(data.amountCents) > 10000000)
    return { ok: false, message: 'Add a description and an amount between $0.01 and $100,000.' }; await db.transaction.create({ data: { type: 'EXPENSE', category: 'REIMBURSEMENT', description: data.description.trim(), amountCents: Number(data.amountCents), status: 'pending' } });  return { ok: true, message: 'Expense submitted. It will affect the balance after treasurer approval.' }; }
export async function approveExpense(id: string) { await requireRole(['TREASURER']); const updated = await db.transaction.updateMany({ where: { id, type: 'EXPENSE', status: 'pending' }, data: { status: 'posted' } }); if (!updated.count)
    return { ok: false, message: 'This request has already been reviewed or is no longer available.' };  return { ok: true, message: 'Reimbursement approved and included in the club balance.' }; }
