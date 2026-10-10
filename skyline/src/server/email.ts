import { db } from "@/lib/db";

export async function deliverQueuedEmail() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    return { configured: false, sent: 0, failed: 0 };
  let sent = 0,
    failed = 0;
  const rows = await db.emailMessage.findMany({
    where: {
      status: { in: ["QUEUED", "FAILED", "SENDING"] },
      attempts: { lt: 5 },
      OR: [
        { claimedAt: null },
        { claimedAt: { lt: new Date(Date.now() - 5 * 60000) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: 50,
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
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
          "Idempotency-Key": row.id,
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM,
          to: [row.to],
          subject: row.subject,
          text: row.body,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(`Email provider returned HTTP ${response.status}`);
      const result: { id?: string } = await response.json();
      await db.emailMessage.update({
        where: { id: row.id },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerId: result.id,
          lastError: null,
          claimedAt: null,
        },
      });
      sent++;
    } catch (error) {
      await db.emailMessage.update({
        where: { id: row.id },
        data: {
          status: "FAILED",
          lastError:
            error instanceof Error ? error.message : "Email delivery failed.",
          claimedAt: null,
        },
      });
      failed++;
    }
  }
  return { configured: true, sent, failed };
}
