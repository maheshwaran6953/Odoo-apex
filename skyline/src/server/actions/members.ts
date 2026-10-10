'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/server/auth';
export async function activateMembership(memberId: string) { await requireRole(['STAFF', 'TREASURER']); try {
    const result = await db.$transaction(async (tx) => { const member = await tx.member.findUnique({ where: { id: memberId }, include: { membership: true } }); if (!member?.membership)
        throw new Error('Membership record was not found.'); if (member.membership.status === 'ACTIVE' && member.membership.expiresAt >= new Date())
        return { ok: false, message: 'This membership is already active. No duplicate dues were recorded.' }; const expiresAt = new Date(); expiresAt.setFullYear(expiresAt.getFullYear() + 1); await tx.membership.update({ where: { memberId }, data: { status: 'ACTIVE', expiresAt } }); await tx.transaction.create({ data: { type: 'INCOME', category: 'DUES', description: `Membership dues — ${member.name}`, amountCents: member.membership.duesCents, memberId } }); return { ok: true, message: `Dues recorded. ${member.name} is active for one year.` }; });
    
    return result;
}
catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to update membership.' };
} }
export async function renewMembership(memberId: string) { return activateMembership(memberId); }
export async function addMember(data: FormData) { await requireRole(['STAFF', 'TREASURER']); const name = String(data.get('name') ?? '').trim(); const email = String(data.get('email') ?? '').trim().toLowerCase(); const dues = Number(data.get('dues')); if (name.length < 2 || name.length > 100 || !/^\S+@\S+\.\S+$/.test(email) || !Number.isFinite(dues) || dues <= 0 || dues > 100000)
    return { ok: false, message: 'Enter a name, valid email, and positive annual dues.' }; try {
    const exists = await db.member.findUnique({ where: { email } });
    if (exists)
        return { ok: false, message: 'A member with this email is already in the directory.' };
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    await db.member.create({ data: { name, email, membership: { create: { duesCents: Math.round(dues * 100), expiresAt, status: 'PENDING' } } } });
    
    return { ok: true, message: `${name} was added. Record their dues to activate membership.` };
}
catch {
    return { ok: false, message: 'Could not add this member. Check that the email is unique.' };
} }

