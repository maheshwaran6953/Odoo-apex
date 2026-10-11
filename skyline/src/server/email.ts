import { db } from "@/lib/db";
import {
  emailDeliveryConfigured,
  emailProvider,
  sendEmail,
  EmailTransportError,
} from "@/server/email-transport";

export async function deliverQueuedEmail(
  options: { key?: string; limit?: number } = {},
  dispatch: typeof sendEmail = sendEmail,
) {
  if (!emailDeliveryConfigured())
    return { configured: false, sent: 0, failed: 0 };
  let sent = 0,
    failed = 0;
  const rows = await db.emailMessage.findMany({
    where: {
      ...(options.key ? { key: options.key } : {}),
      status: { in: ["QUEUED", "FAILED", "SENDING"] },
      attempts: { lt: 5 },
      OR: [
        { claimedAt: null },
        { claimedAt: { lt: new Date(Date.now() - 5 * 60000) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(50, Math.trunc(options.limit || 50))),
  });
  for (const row of rows) {
    let obsolete = false;
    if (row.key.startsWith("otp:")) {
      const otp = await db.emailOtp.findUnique({
        where: { userId: row.key.split(":")[1] },
      });
      obsolete =
        !otp ||
        otp.expiresAt <= new Date() ||
        row.key !== `otp:${otp.userId}:${otp.requestedAt.toISOString()}`;
    } else if (row.key.startsWith("membership:")) {
      const [, membershipId, expiry, stage] = row.key.split(":");
      const membership = await db.membership.findUnique({
        where: { id: membershipId },
        include: { member: { include: { user: true } } },
      });
      const user = membership?.member.user;
      obsolete =
        !membership ||
        !user ||
        !!user.disabledAt ||
        !user.emailVerifiedAt ||
        user.approvalStatus !== "APPROVED" ||
        !user.emailReminders ||
        membership.expiresAt.getTime() !== Number(expiry) ||
        (stage === "renewal"
          ? membership.status !== "ACTIVE" || membership.expiresAt <= new Date()
          : membership.expiresAt > new Date());
    } else if (row.key.startsWith("announcement:")) {
      const [, announcementId, userId] = row.key.split(":");
      const [announcement, user] = await Promise.all([
        db.announcement.findUnique({ where: { id: announcementId } }),
        db.user.findUnique({ where: { id: userId } }),
      ]);
      obsolete =
        !announcement ||
        !user ||
        !!user.disabledAt ||
        !user.emailVerifiedAt ||
        user.approvalStatus !== "APPROVED" ||
        !user.emailReminders;
    } else if (row.key.startsWith("account:")) {
      const token = await db.accountToken.findUnique({
        where: { id: row.key.slice(8) },
      });
      obsolete = !token || token.expiresAt <= new Date();
    } else if (row.key.startsWith("offer:")) {
      const entry = await db.waitlistEntry.findUnique({
        where: { id: row.key.split(":")[1] },
      });
      obsolete =
        !entry ||
        entry.status !== "OFFERED" ||
        !entry.offerExpiresAt ||
        entry.offerExpiresAt <= new Date() ||
        row.key !== `offer:${entry.id}:${entry.offeredAt?.toISOString()}`;
    } else if (row.key.startsWith("reminder:")) {
      const ticket = await db.ticket.findUnique({
        where: { id: row.key.split(":")[1] },
        include: { event: true },
      });
      obsolete =
        !ticket ||
        ticket.status !== "PAID" ||
        !!ticket.event.cancelledAt ||
        ticket.event.startsAt <= new Date() ||
        row.key !==
          `reminder:${ticket.id}:${ticket.event.startsAt.toISOString()}`;
    }
    if (obsolete) {
      await db.emailMessage.update({
        where: { id: row.id },
        data: {
          status: "CANCELLED",
          lastError: "Superseded or expired before delivery.",
          ...(row.key.startsWith("otp:")
            ? { body: "Expired verification email; code removed." }
            : {}),
        },
      });
      continue;
    }
    if (emailProvider() === "smtp" && row.status === "SENDING") {
      await db.emailMessage.updateMany({
        where: { id: row.id, status: "SENDING", claimedAt: row.claimedAt },
        data: {
          status: "REVIEW",
          lastError:
            "SMTP delivery was interrupted; check delivery before retrying.",
        },
      });
      continue;
    }
    // Resend's idempotency window is 24h. Ambiguous retries after that need review.
    if (
      row.attempts > 0 &&
      Date.now() - row.createdAt.getTime() >= 23 * 3600000
    ) {
      await db.emailMessage.update({
        where: { id: row.id },
        data: {
          status: "REVIEW",
          lastError:
            "Delivery uncertain outside the safe idempotency retry window. Review provider logs.",
        },
      });
      continue;
    }
    const claimed = await db.emailMessage.updateMany({
      where: {
        id: row.id,
        status: row.status,
        attempts: row.attempts,
        claimedAt: row.claimedAt,
      },
      data: {
        status: "SENDING",
        claimedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) continue;
    try {
      const providerId = await dispatch({
        id: row.id,
        to: row.to,
        subject: row.subject,
        body: row.body,
      });
      await db.emailMessage.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId,
          ...(row.key.startsWith("otp:")
            ? {
                body: "Verification email accepted; code removed from local outbox.",
              }
            : {}),
          lastError: null,
          claimedAt: null,
        },
      });
      sent++;
    } catch (error) {
      await db.emailMessage.update({
        where: { id: row.id },
        data: {
          status:
            emailProvider() === "smtp" &&
            !(error instanceof EmailTransportError && error.retrySafe)
              ? "REVIEW"
              : "FAILED",
          lastError:
            error instanceof EmailTransportError
              ? error.message
              : "Email delivery failed; retry status requires review.",
          claimedAt: null,
        },
      });
      failed++;
    }
  }
  return { configured: true, sent, failed };
}
