"use server";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/server/auth";
import { deliverQueuedEmail } from "@/server/email";
export async function markRead(data: FormData) {
  const user = await requireUser();
  await db.notification.updateMany({
    where: {
      userId: user.id,
      ...(data.get("id") ? { id: String(data.get("id")) } : {}),
    },
    data: { readAt: new Date() },
  });
  return { ok: true, message: "Updates marked as read." };
}
export async function sendQueuedEmail() {
  await requireRole(["STAFF"]);
  const result = await deliverQueuedEmail();
  return {
    ok: result.configured && result.failed === 0,
    message: result.configured
      ? `${result.sent} messages sent; ${result.failed} failed. Review delivery status below.`
      : "Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM. Messages remain queued.",
  };
}
