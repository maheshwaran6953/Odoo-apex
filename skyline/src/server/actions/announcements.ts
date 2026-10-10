'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/server/auth';
export async function publishAnnouncement(input: unknown) { await requireRole(['STAFF', 'TREASURER']); const data = input instanceof FormData ? { title: input.get('title'), body: input.get('body') } : input as {
    title?: string;
    body?: string;
}; if (typeof data.title !== 'string' || data.title.trim().length < 3 || data.title.length > 120 || typeof data.body !== 'string' || data.body.trim().length < 10 || data.body.length > 4000)
    return { ok: false, message: 'Use a title of 3–120 characters and a message of 10–4,000 characters.' }; await db.announcement.create({ data: { title: data.title.trim(), body: data.body.trim() } });  return { ok: true, message: 'Update published to the club noticeboard.' }; }

