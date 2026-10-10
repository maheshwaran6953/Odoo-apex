import { cookies } from 'next/headers';

export type Role = 'MEMBER' | 'STAFF' | 'TREASURER';

export async function currentRole(): Promise<Role> {
  const value = (await cookies()).get('skyline_role')?.value;
  return value === 'STAFF' || value === 'TREASURER' ? value : 'MEMBER';
}

export async function requireRole(allowed: Role[]) {
  const role = await currentRole();
  if (!allowed.includes(role)) throw new Error('You do not have permission to perform this action.');
  return role;
}
