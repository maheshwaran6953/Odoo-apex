'use server';

import { db } from '@/lib/db';
import { requireRole } from '@/server/auth';
export async function moveTask(input: unknown) { await requireRole(['STAFF']); const data = input instanceof FormData ? { taskId: input.get('taskId'), status: input.get('status') } : input as {
    taskId?: string;
    status?: string;
}; if (typeof data.taskId !== 'string' || !['TODO', 'DOING', 'DONE'].includes(String(data.status)))
    return { ok: false, message: 'Choose a valid task status.' }; await db.task.update({ where: { id: data.taskId }, data: { status: data.status as 'TODO' | 'DOING' | 'DONE' } });  return { ok: true, message: 'Task status updated on the board.' }; }
export async function addTask(data: FormData) { await requireRole(['STAFF']); const title = String(data.get('title') ?? '').trim(); const description = String(data.get('description') ?? '').trim(); const assigneeId = String(data.get('assigneeId') ?? '') || undefined; const rawDate = String(data.get('dueAt') ?? ''); const dueAt = rawDate ? new Date(rawDate) : undefined; if (title.length < 3 || title.length > 200 || (dueAt && !Number.isFinite(dueAt.getTime())))
    return { ok: false, message: 'Add a task title of 3–200 characters and a valid due date.' }; if (assigneeId && !await db.member.findUnique({ where: { id: assigneeId } }))
    return { ok: false, message: 'Choose an existing volunteer.' }; await db.task.create({ data: { title, description: description || undefined, assigneeId, dueAt } });  return { ok: true, message: 'Task added to the To do column.' }; }
