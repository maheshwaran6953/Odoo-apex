import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { newToken } from "@/lib/password";

export type EventTx = Prisma.TransactionClient;
export const CHECKOUT_HOLD_STATES = ["INIT", "CREATING", "PENDING"];
export async function paymentHoldCount(tx: EventTx, eventId: string) {
  return tx.payment.count({
    where: {
      eventId,
      status: { in: CHECKOUT_HOLD_STATES },
      expiresAt: { gt: new Date() },
    },
  });
}
export async function expirePaymentHolds(tx: EventTx, eventId: string) {
  const now = new Date();
  const expired = await tx.payment.findMany({
    where: {
      eventId,
      status: { in: CHECKOUT_HOLD_STATES },
      expiresAt: { lte: now },
    },
  });
  for (const payment of expired) {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: "EXPIRED",
        issue:
          "Seat hold expired. A later captured payment requires staff review.",
      },
    });
    const entry = await tx.waitlistEntry.findUnique({
      where: { eventId_userId: { eventId, userId: payment.userId } },
    });
    if (entry?.status === "PAYMENT_PENDING")
      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          status:
            entry.offerExpiresAt && entry.offerExpiresAt > now
              ? "OFFERED"
              : "EXPIRED",
        },
      });
  }
}
export async function eventTransaction<T>(
  eventId: string,
  fn: (tx: EventTx) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(
        async (tx) => {
          // All seat mutations lock the same event row before checking capacity.
          await tx.event.update({
            where: { id: eventId },
            data: { version: { increment: 1 } },
          });
          return fn(tx);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 10000,
          timeout: 15000,
        },
      );
    } catch (error) {
      const code =
        error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "";
      if (!["P2034", "P1008"].includes(code) || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (attempt + 1)));
    }
  }
  throw new Error("Booking is busy. Please retry.");
}

export function bookingOpen(event: {
  startsAt: Date;
  registrationClosesAt: Date | null;
  cancelledAt: Date | null;
}) {
  const now = new Date();
  return (
    !event.cancelledAt &&
    event.startsAt > now &&
    (!event.registrationClosesAt || event.registrationClosesAt > now)
  );
}

export async function notify(
  tx: EventTx,
  userId: string,
  key: string,
  title: string,
  body: string,
  href: string,
  email = true,
) {
  await tx.notification.upsert({
    where: { key },
    create: { userId, key, title, body, href },
    update: {},
  });
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  if (
    email &&
    user.emailReminders &&
    user.emailVerifiedAt &&
    !user.disabledAt
  ) {
    await tx.emailMessage.upsert({
      where: { key },
      create: {
        key,
        to: user.email,
        subject: title,
        body: `${body}\n${process.env.APP_URL || "http://localhost:3001"}${href}`,
      },
      update: {},
    });
  }
}

export async function promoteWaitlist(tx: EventTx, eventId: string) {
  await expirePaymentHolds(tx, eventId);
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
  const now = new Date();
  const expired = await tx.waitlistEntry.findMany({
    where: { eventId, status: "OFFERED", offerExpiresAt: { lte: now } },
  });
  for (const entry of expired) {
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "EXPIRED" },
    });
    await notify(
      tx,
      entry.userId,
      `offer-expired:${entry.id}:${entry.offeredAt?.toISOString()}`,
      "Your seat offer expired",
      `${event.name}: the unclaimed seat has returned to the waitlist.`,
      `/events/${eventId}`,
    );
  }
  if (!bookingOpen(event)) {
    await tx.waitlistEntry.updateMany({
      where: { eventId, status: { in: ["WAITING", "OFFERED"] } },
      data: { status: "CLOSED" },
    });
    return;
  }
  const registered = await tx.ticket.count({
    where: { eventId, status: { not: "CANCELLED" } },
  });
  const offers = await tx.waitlistEntry.count({
    where: { eventId, status: "OFFERED", offerExpiresAt: { gt: now } },
  });
  const count = Math.max(
    0,
    event.capacity -
      registered -
      offers -
      (await paymentHoldCount(tx, eventId)),
  );
  const next = await tx.waitlistEntry.findMany({
    where: {
      eventId,
      status: "WAITING",
      user: {
        disabledAt: null,
        emailVerifiedAt: { not: null },
        approvalStatus: "APPROVED",
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: count,
    include: { user: true },
  });
  for (const entry of next) {
    if (
      entry.user.disabledAt ||
      !entry.user.emailVerifiedAt ||
      entry.user.approvalStatus !== "APPROVED"
    ) {
      await tx.waitlistEntry.update({
        where: { id: entry.id },
        data: { status: "LEFT" },
      });
      continue;
    }
    const offerExpiresAt = new Date(
      Math.min(
        Date.now() + 2 * 3600000,
        event.registrationClosesAt?.getTime() || event.startsAt.getTime(),
        event.startsAt.getTime(),
      ),
    );
    await tx.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "OFFERED", offeredAt: now, offerExpiresAt },
    });
    await notify(
      tx,
      entry.userId,
      `offer:${entry.id}:${now.toISOString()}`,
      "A seat is available for you",
      `${event.name}: confirm your place before ${offerExpiresAt.toISOString()}. The offer reserves one seat until it expires.`,
      `/events/${eventId}`,
    );
  }
}

export async function registerAttendee(
  tx: EventTx,
  eventId: string,
  userId: string,
  phone?: string,
) {
  await promoteWaitlist(tx, eventId);
  const event = await tx.event.findUniqueOrThrow({ where: { id: eventId } });
  if (event.paymentMode !== "PRACTICE")
    throw new Error(
      "This event requires verified Razorpay Test Mode checkout. Practice registration cannot bypass payment.",
    );
  if (!bookingOpen(event))
    throw new Error("Registration is closed for this event.");
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    include: { member: { include: { membership: true } } },
  });
  if (
    user.disabledAt ||
    !user.emailVerifiedAt ||
    user.approvalStatus !== "APPROVED"
  )
    throw new Error(
      "Verify your email before registering. Club staff can also confirm your identity.",
    );
  const previous = await tx.ticket.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  if (previous && previous.status !== "CANCELLED")
    throw new Error(
      "You already have a registration. Open My events to view your ticket.",
    );
  const own = await tx.waitlistEntry.findUnique({
    where: { eventId_userId: { eventId, userId } },
  });
  const registered = await tx.ticket.count({
    where: { eventId, status: { not: "CANCELLED" } },
  });
  const reserved = await tx.waitlistEntry.count({
    where: { eventId, status: "OFFERED", offerExpiresAt: { gt: new Date() } },
  });
  const hasOffer =
    own?.status === "OFFERED" &&
    !!own.offerExpiresAt &&
    own.offerExpiresAt > new Date();
  if (
    registered +
      reserved +
      (await paymentHoldCount(tx, eventId)) -
      (hasOffer ? 1 : 0) >=
    event.capacity
  )
    throw new Error("No seats are available. Join the waitlist instead.");
  const membership = user.member?.membership;
  const isMember =
    membership?.status === "ACTIVE" && membership.expiresAt > new Date();
  const qrToken = newToken();
  const ticketData = {
    eventId,
    userId,
    memberId: user.memberId,
    attendeeName: user.name,
    attendeeEmail: user.email,
    attendeePhone: phone || null,
    code: `SKY-${newToken().slice(0, 20).toUpperCase()}`,
    qrToken,
    type: isMember ? ("MEMBER" as const) : ("NON_MEMBER" as const),
    status: "PAID" as const,
    priceCents: isMember ? event.memberPriceCents : event.nonMemberPriceCents,
    cancelledAt: null,
    checkedInAt: null,
    reminderAt: null,
    currency: event.currency,
    paymentMode: "PRACTICE",
  };
  const ledger = await tx.transaction.create({
    data: {
      type: "INCOME",
      category: "TICKET",
      description: `${event.name} registration — simulated payment`,
      amountCents: ticketData.priceCents,
      memberId: user.memberId,
      currency: event.currency,
    },
  });
  const ticket = previous
    ? await tx.ticket.update({
        where: { id: previous.id },
        data: { ...ticketData, ledgerId: ledger.id },
      })
    : await tx.ticket.create({ data: { ...ticketData, ledgerId: ledger.id } });
  if (own)
    await tx.waitlistEntry.update({
      where: { id: own.id },
      data: { status: "CLAIMED" },
    });
  await notify(
    tx,
    userId,
    `registered:${ticket.id}:${qrToken}`,
    "Your place is confirmed",
    `${event.name} at ${event.location}. Save your QR ticket for entry. Payment is simulated; no charge was made.`,
    `/tickets/${ticket.id}`,
  );
  return ticket;
}

export async function processEventUpdates() {
  const events = await db.event.findMany({
    where: {
      cancelledAt: null,
      OR: [
        { startsAt: { gt: new Date() } },
        { waitlist: { some: { status: { in: ["WAITING", "OFFERED"] } } } },
      ],
    },
    select: { id: true },
  });
  for (const event of events) {
    await eventTransaction(event.id, async (tx) => {
      await promoteWaitlist(tx, event.id);
      const current = await tx.event.findUniqueOrThrow({
        where: { id: event.id },
      });
      if (
        current.cancelledAt ||
        current.startsAt <= new Date() ||
        current.startsAt.getTime() - Date.now() > 24 * 3600000
      )
        return;
      const tickets = await tx.ticket.findMany({
        where: {
          eventId: event.id,
          status: "PAID",
          userId: { not: null },
          reminderAt: null,
        },
      });
      for (const ticket of tickets) {
        await notify(
          tx,
          ticket.userId!,
          `reminder:${ticket.id}:${current.startsAt.toISOString()}`,
          "Your event is coming up",
          `${current.name} starts ${current.startsAt.toISOString()} at ${current.location}. Bring your QR ticket.`,
          `/tickets/${ticket.id}`,
        );
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { reminderAt: new Date() },
        });
      }
    });
  }
}

/** Caller must verify ownership; invoked under the event row lock. */
export async function cancelTicketRegistration(tx: EventTx, id: string) {
  const ticket = await tx.ticket.findUniqueOrThrow({
    where: { id },
    include: { event: true },
  });
  if (ticket.status === "CANCELLED")
    throw new Error("This registration is already cancelled.");
  if (ticket.status === "CHECKED_IN" || ticket.event.startsAt <= new Date())
    throw new Error(
      "Attendance has started. This registration cannot be cancelled.",
    );
  await tx.ticket.update({
    where: { id },
    data: { status: "CANCELLED", cancelledAt: new Date(), qrToken: null },
  });
  if (ticket.paymentMode === "RAZORPAY_TEST")
    await tx.payment.updateMany({
      where: { ticketId: id, status: "CONFIRMED", ledgerId: ticket.ledgerId },
      data: {
        status: "REFUND_REQUIRED",
        issue:
          "Ticket cancelled. A full test refund must be requested and confirmed separately.",
      },
    });
  if (ticket.ledgerId && ticket.paymentMode !== "RAZORPAY_TEST")
    await tx.transaction.update({
      where: { id: ticket.ledgerId },
      data: { status: "void" },
    });
  if (ticket.userId)
    await notify(
      tx,
      ticket.userId,
      `cancelled:${id}:${ticket.code}`,
      "Registration cancelled",
      `${ticket.event.name}: your place was released. ${ticket.paymentMode === "RAZORPAY_TEST" ? "Your test refund is required and must be confirmed separately by staff." : ticket.ledgerId ? "The linked simulated income entry was voided." : "This legacy ticket has no linked income entry; ask the treasurer to reconcile its record."} No real funds were involved.`,
      "/my-events",
    );
  await promoteWaitlist(tx, ticket.eventId);
}
