import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { tokenHash } from "@/lib/password";
export type Role = "MEMBER" | "STAFF" | "TREASURER";
export const currentUser = cache(async () => {
  const token = (await cookies()).get("skyline_session")?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: tokenHash(token) },
    include: {
      user: { include: { member: { include: { membership: true } } } },
    },
  });
  return !session || session.expiresAt <= new Date() || session.user.disabledAt
    ? null
    : session.user;
});
export async function requireSessionUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireUser() {
  const user = await requireSessionUser();
  if (!user.emailVerifiedAt) redirect("/verify-email");
  if (user.approvalStatus !== "APPROVED") redirect("/access-status");
  return user;
}
export async function currentRole(): Promise<Role> {
  const user = await currentUser();
  return user?.role === "STAFF" || user?.role === "TREASURER"
    ? user.role
    : "MEMBER";
}
export async function requireRole(allowed: Role[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role as Role)) redirect("/access-denied");
  return user.role as Role;
}
export async function requireApprover() {
  const user = await requireUser();
  if (user.role !== "STAFF" || !user.isRoleApprover) redirect("/access-denied");
  return user;
}
export function roleHome(role: string) {
  return role === "TREASURER"
    ? "/treasurer"
    : role === "STAFF"
      ? "/"
      : "/my-events";
}
