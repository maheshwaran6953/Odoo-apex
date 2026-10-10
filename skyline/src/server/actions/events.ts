'use server';

import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { requireRole } from '@/server/auth';
export async function purchaseTicket(input: unknown) { await requireRole(['MEMBER', 'STAFF']); const data = input instanceof FormData ? { eventId: input.get('eventId'), memberId: input.get('memberId') || undefined } : input as {
    eventId?: string;
    memberId?: string;
}; if (typeof data.eventId !== 'string' || (data.memberId !== undefined && typeof data.memberId !== 'string'))
    return { ok: false, message: 'Choose a valid event and attendee.' }; const eventId = data.eventId; const memberId = data.memberId as string | undefined; try {
    const result = await db.$transaction(async (tx) => { const event = await tx.event.findUnique({ where: { id: eventId }, include: { tickets: true } }); if (!event)
        throw new Error('Event not found.'); if (event.startsAt < new Date())
        throw new Error('Booking has closed for this event.'); if (event.tickets.filter(t => t.status !== 'CANCELLED').length >= event.capacity)
        throw new Error('This event is sold out.'); const member = memberId ? await tx.member.findUnique({ where: { id: memberId }, include: { membership: true } }) : null; if (memberId && !member)
        throw new Error('This member could not be found.'); const isMember = member?.membership?.status === 'ACTIVE' && member.membership.expiresAt >= new Date(); const ticket = await tx.ticket.create({ data: { eventId, memberId: member?.id, type: isMember ? 'MEMBER' : 'NON_MEMBER', priceCents: isMember ? event.memberPriceCents : event.nonMemberPriceCents, code: `SKY-${randomUUID().slice(0, 8).toUpperCase()}` } }); await tx.transaction.create({ data: { type: 'INCOME', category: 'TICKET', description: `${event.name} ticket`, amountCents: ticket.priceCents, memberId: member?.id } }); return ticket; });
    
    return { ok: true, message: 'Your ticket is booked. Save your entry code below.', code: result.code };
}
catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Unable to book this ticket.' };
} }
export async function checkInTicket(input: unknown) { await requireRole(['STAFF']); const raw = input instanceof FormData ? input.get('code') : input; if (typeof raw !== 'string' || !raw.trim())
    return { ok: false, message: 'Enter a ticket code.' }; const ticket = await db.ticket.findUnique({ where: { code: raw.trim().toUpperCase() }, include: { event: true, member: true } }); if (!ticket)
    return { ok: false, message: 'Ticket not found. Check the code and try again.' }; if (ticket.status === 'CHECKED_IN')
    return { ok: false, message: 'Already checked in. This code cannot be used for a second entry.' }; if (ticket.status !== 'PAID')
    return { ok: false, message: 'This ticket is not valid for entry.' }; const updated = await db.ticket.updateMany({ where: { id: ticket.id, status: 'PAID' }, data: { status: 'CHECKED_IN', checkedInAt: new Date() } }); if (!updated.count)
    return { ok: false, message: 'This ticket was just checked in by another staff member.' };  return { ok: true, message: `Welcome, ${ticket.member?.name ?? 'guest'}! Checked in for ${ticket.event.name}.` }; }
export async function addEvent(data: FormData) { await requireRole(['STAFF']); const name = String(data.get('name') ?? '').trim(); const description = String(data.get('description') ?? '').trim(); const location = String(data.get('location') ?? '').trim(); const startsAt = new Date(String(data.get('startsAt'))); const capacity = Number(data.get('capacity')); const memberPrice = Number(data.get('memberPrice')); const guestPrice = Number(data.get('guestPrice')); if (name.length < 3 || description.length < 10 || !location || !Number.isFinite(startsAt.getTime()) || startsAt <= new Date() || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000 || !Number.isFinite(memberPrice) || memberPrice < 0 || !Number.isFinite(guestPrice) || guestPrice < 0 || memberPrice > 100000 || guestPrice > 100000)
    return { ok: false, message: 'Enter complete event details, a future date, valid capacity, and non-negative prices.' }; await db.event.create({ data: { name, description, location, startsAt, capacity, memberPriceCents: Math.round(memberPrice * 100), nonMemberPriceCents: Math.round(guestPrice * 100) } });  return { ok: true, message: `${name} is on the calendar. Ticket booking is open.` }; }

// Every route reads cookies in the root layout and is dynamically rendered.
// Mutation forms refresh the router after saving; do not revalidate the whole
// root layout here, because that remounts the form and discards ticket codes.
