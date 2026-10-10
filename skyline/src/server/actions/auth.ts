'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
export async function setDemoRole(input: FormData) { const role = input.get('role'); if (role !== 'MEMBER' && role !== 'STAFF' && role !== 'TREASURER')
    return; cookies().set('skyline_role', role, { httpOnly: true, sameSite: 'lax', path: '/' }); revalidatePath('/', 'layout'); redirect('/'); }
export async function signOut() { cookies().delete('skyline_role'); revalidatePath('/', 'layout'); redirect('/login'); }
