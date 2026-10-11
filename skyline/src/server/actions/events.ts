"use server";
import { moneyCents, validEmail, validName } from "@/lib/validation";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/server/auth";
import {
  eventTransaction,
  cancelTicketRegistration,
  registerAttendee,
  promoteWaitlist,
  bookingOpen,
  notify,
  processEventUpdates,
  paymentHoldCount,
  CHECKOUT_HOLD_STATES,
} from "@/server/events-service";

function fail(error: unknown) {
  if (error instanceof Error && error.name.startsWith("Prisma"))
    return {
      ok: false,
      message:
        "The event changed or could not be saved. Refresh and try again.",
    };
  return {
    ok: false,
    message:
      error instanceof Error
        ? error.message
        : "The event could not be updated. Try again.",
  };
}
export async function purchaseTicket(data: FormData) {
  const actor = await requireUser();
  const eventId = String(data.get("eventId") || "");
  const userId =
    actor.role === "STAFF" && data.get("userId")
      ? String(data.get("userId"))
      : actor.id;
  const phone = String(data.get("phone") || "").trim();
  if (phone.length > 30 || (phone && !/^[+\d\s().-]+$/.test(phone)))
    return { ok: false, message: "Enter a valid optional phone number." };
  try {
    await eventTransaction(eventId, (tx) => promoteWaitlist(tx, eventId));
    const ticket = await eventTransaction(eventId, (tx) =>
      registerAttendee(tx, eventId, userId, phone),
    );
    return {
      ok: true,
      message:
        "Registration confirmed. Open My events for your QR ticket. No payment was charged.",
      code: ticket.code,
      href: `/tickets/${ticket.id}`,
    };
  } catch (error) {
    return fail(error);
  }
}
export async function joinWaitlist(data: FormData) {
  const user = await requireUser();
  if (!user.emailVerifiedAt)
    return {
      ok: false,
      message:
        "Verify your email or ask staff to confirm your identity before joining.",
    };
  const eventId = String(data.get("eventId") || "");
  try {
    await eventTransaction(eventId, async (tx) => {
      await promoteWaitlist(tx, eventId);
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
      });
      if (!bookingOpen(event)) throw new Error("This event is closed.");
      const ticket = await tx.ticket.findUnique({
        where: { eventId_userId: { eventId, userId: user.id } },
      });
      if (ticket && ticket.status !== "CANCELLED")
        throw new Error("You are already registered.");
      const existing = await tx.waitlistEntry.findUnique({
        where: { eventId_userId: { eventId, userId: user.id } },
      });
      if (
        await tx.payment.count({
          where: {
            eventId,
            userId: user.id,
            status: { in: CHECKOUT_HOLD_STATES },
            expiresAt: { gt: new Date() },
          },
        })
      )
        throw new Error(
          "Your checkout already holds a seat. Open My payments.",
        );
      if (existing && ["WAITING", "OFFERED"].includes(existing.status))
        throw new Error("You are already on the waitlist.");
      const sold = await tx.ticket.count({
        where: { eventId, status: { not: "CANCELLED" } },
      });
      const offers = await tx.waitlistEntry.count({
        where: {
          eventId,
          status: "OFFERED",
          offerExpiresAt: { gt: new Date() },
        },
      });
      if (
        sold + offers + (await paymentHoldCount(tx, eventId)) <
        event.capacity
      )
        throw new Error("Seats are available. Register directly instead.");
      const entry = await tx.waitlistEntry.upsert({
        where: { eventId_userId: { eventId, userId: user.id } },
        create: { eventId, userId: user.id },
        update: {
          status: "WAITING",
          createdAt: new Date(),
          offeredAt: null,
          offerExpiresAt: null,
        },
      });
      await notify(
        tx,
        user.id,
        `waitlist:${entry.id}:${entry.createdAt.toISOString()}`,
        "You are on the waitlist",
        `${event.name}: offers are made in joining order. A seat offer lasts up to two hours.`,
        `/events/${eventId}`,
      );
    });
    return {
      ok: true,
      message:
        "You joined the waitlist. Your position is visible in My events.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function leaveWaitlist(data: FormData) {
  const user = await requireUser();
  const eventId = String(data.get("eventId") || "");
  try {
    await eventTransaction(eventId, async (tx) => {
      if (
        await tx.waitlistEntry.count({
          where: { eventId, userId: user.id, status: "PAYMENT_PENDING" },
        })
      )
        throw new Error(
          "Release the checkout hold from My payments before leaving this offer.",
        );
      await tx.waitlistEntry.updateMany({
        where: {
          eventId,
          userId: user.id,
          status: { in: ["WAITING", "OFFERED"] },
        },
        data: { status: "LEFT" },
      });
      await promoteWaitlist(tx, eventId);
    });
    return {
      ok: true,
      message: "You left the waitlist. Any reserved offer was released.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function cancelRegistration(data: FormData) {
  const user = await requireUser();
  const id = String(data.get("ticketId") || "");
  const existing = await db.ticket.findUnique({ where: { id } });
  if (!existing || (existing.userId !== user.id && user.role !== "STAFF"))
    return { ok: false, message: "Registration not found." };
  try {
    await eventTransaction(existing.eventId, async (tx) => {
      await cancelTicketRegistration(tx, id);
    });
    return {
      ok: true,
      message:
        "Registration cancelled and seat released. No real refund was processed.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function checkInTicket(data: FormData) {
  await requireRole(["STAFF"]);
  const raw = String(data.get("code") || "").trim();
  const eventId = String(data.get("eventId") || "");
  if (!eventId || !raw || raw.length > 200)
    return {
      ok: false,
      message: "Choose the event and scan or enter a ticket code.",
    };
  const token = raw.startsWith("skyline:") ? raw.slice(8) : null;
  const ticket = token
    ? await db.ticket.findUnique({
        where: { qrToken: token },
        include: { event: true },
      })
    : await db.ticket.findUnique({
        where: { code: raw.toUpperCase() },
        include: { event: true },
      });
  if (!ticket || ticket.eventId !== eventId)
    return {
      ok: false,
      message:
        "This ticket does not belong to the selected event, or the code is invalid.",
    };
  if (ticket.event.cancelledAt)
    return { ok: false, message: "This event was cancelled. Entry is closed." };
  if (ticket.status === "CHECKED_IN")
    return {
      ok: false,
      message: `Already checked in at ${ticket.checkedInAt?.toLocaleTimeString()}. Second entry rejected.`,
    };
  if (ticket.status !== "PAID")
    return { ok: false, message: "This ticket is not valid for entry." };
  if (Math.abs(Date.now() - ticket.event.startsAt.getTime()) > 12 * 3600000)
    return {
      ok: false,
      message:
        "Entry opens 12 hours before the event and closes 12 hours after its start.",
    };
  const saved = await eventTransaction(eventId, (tx) =>
    tx.ticket.updateMany({
      where: {
        id: ticket.id,
        status: "PAID",
        event: {
          cancelledAt: null,
          startsAt: {
            gte: new Date(Date.now() - 12 * 3600000),
            lte: new Date(Date.now() + 12 * 3600000),
          },
        },
      },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    }),
  );
  if (!saved.count)
    return {
      ok: false,
      message:
        "The ticket was just used or the event was cancelled. Refresh and try again.",
    };
  return {
    ok: true,
    message: `Welcome, ${ticket.attendeeName || "guest"}! Entry recorded for ${ticket.event.name}.`,
  };
}
export async function saveEvent(data: FormData) {
  await requireRole(["STAFF"]);
  const id = String(data.get("eventId") || "");
  const name = String(data.get("name") || "").trim();
  const description = String(data.get("description") || "").trim();
  const location = String(data.get("location") || "").trim();
  const schedule = String(data.get("schedule") || "").trim();
  const organizerEmail = String(data.get("organizerEmail") || "").trim();
  const startsAt = new Date(String(data.get("startsAt")));
  const close = String(data.get("registrationClosesAt") || "");
  const registrationClosesAt = close ? new Date(close) : null;
  const capacity = Number(data.get("capacity"));
  const memberCents = moneyCents(data.get("memberPrice"), true);
  const guestCents = moneyCents(data.get("guestPrice"), true);
  const memberPrice = (memberCents ?? -1) / 100;
  const guestPrice = (guestCents ?? -1) / 100;
  const currency = String(data.get("currency") || "USD");
  const paymentMode = String(data.get("paymentMode") || "PRACTICE");
  if (
    !["USD", "INR"].includes(currency) ||
    !["PRACTICE", "RAZORPAY_TEST"].includes(paymentMode) ||
    (paymentMode === "RAZORPAY_TEST" &&
      (currency !== "INR" || memberPrice < 1 || guestPrice < 1)) ||
    (paymentMode === "PRACTICE" && currency !== "USD") ||
    !/^\d+(\.\d{1,2})?$/.test(String(data.get("memberPrice"))) ||
    !/^\d+(\.\d{1,2})?$/.test(String(data.get("guestPrice"))) ||
    !validName(name, 3) ||
    description.length < 10 ||
    description.length > 3000 ||
    !location ||
    location.length > 200 ||
    schedule.length > 3000 ||
    (organizerEmail && !validEmail(organizerEmail)) ||
    !Number.isFinite(startsAt.getTime()) ||
    startsAt <= new Date() ||
    (registrationClosesAt &&
      (!Number.isFinite(registrationClosesAt.getTime()) ||
        registrationClosesAt <= new Date() ||
        registrationClosesAt > startsAt)) ||
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    capacity > 10000 ||
    !Number.isFinite(memberPrice) ||
    memberPrice < 0 ||
    !Number.isFinite(guestPrice) ||
    guestPrice < 0 ||
    memberPrice > 100000 ||
    guestPrice > 100000
  )
    return {
      ok: false,
      message:
        "Check event details, dates and prices. Razorpay Test Mode requires INR prices of ₹1 or more; practice events use USD. Use at most two decimal places.",
    };
  const fields = {
    currency,
    paymentMode,
    name,
    description,
    location,
    schedule,
    organizerEmail: organizerEmail || null,
    startsAt,
    registrationClosesAt,
    capacity,
    memberPriceCents: memberCents!,
    nonMemberPriceCents: guestCents!,
  };
  try {
    if (!id) await db.event.create({ data: fields });
    else
      await eventTransaction(id, async (tx) => {
        const old = await tx.event.findUniqueOrThrow({ where: { id } });
        if (old.cancelledAt || old.startsAt <= new Date())
          throw new Error("Cancelled or past events cannot be edited.");
        const registered = await tx.ticket.count({
          where: { eventId: id, status: { not: "CANCELLED" } },
        });
        const offers = await tx.waitlistEntry.count({
          where: {
            eventId: id,
            status: "OFFERED",
            offerExpiresAt: { gt: new Date() },
          },
        });
        const holds = await paymentHoldCount(tx, id);
        if (
          (old.currency !== currency || old.paymentMode !== paymentMode) &&
          ((await tx.ticket.count({ where: { eventId: id } })) ||
            (await tx.payment.count({ where: { eventId: id } })))
        )
          throw new Error(
            "Currency and checkout mode cannot change after a ticket or payment attempt exists.",
          );
        if (capacity < registered + offers + holds)
          throw new Error(
            "Capacity cannot be lower than registrations plus active seat offers.",
          );
        await tx.event.update({ where: { id }, data: fields });
        const changed =
          old.startsAt.getTime() !== startsAt.getTime() ||
          old.location !== location ||
          old.name !== name ||
          old.schedule !== schedule;
        if (changed) {
          await tx.ticket.updateMany({
            where: { eventId: id },
            data: { reminderAt: null },
          });
          const recipients = new Set(
            (
              await tx.ticket.findMany({
                where: {
                  eventId: id,
                  status: { not: "CANCELLED" },
                  userId: { not: null },
                },
                select: { userId: true },
              })
            ).map((t) => t.userId!),
          );
          for (const entry of await tx.waitlistEntry.findMany({
            where: {
              eventId: id,
              status: { in: ["WAITING", "OFFERED", "PAYMENT_PENDING"] },
            },
          }))
            recipients.add(entry.userId);
          for (const hold of await tx.payment.findMany({
            where: {
              eventId: id,
              status: { in: CHECKOUT_HOLD_STATES },
              expiresAt: { gt: new Date() },
            },
            select: { userId: true },
          }))
            recipients.add(hold.userId);
          for (const userId of Array.from(recipients))
            await notify(
              tx,
              userId,
              `event-update:${id}:${old.version + 1}:${userId}`,
              "Event details changed",
              `${name}: ${startsAt.toISOString()} at ${location}. Review the updated schedule. Existing ticket prices are unchanged.`,
              `/events/${id}`,
            );
        }
        if (registrationClosesAt)
          await tx.waitlistEntry.updateMany({
            where: {
              eventId: id,
              status: "OFFERED",
              offerExpiresAt: { gt: registrationClosesAt },
            },
            data: { offerExpiresAt: registrationClosesAt },
          });
        await tx.payment.updateMany({
          where: {
            eventId: id,
            status: { in: CHECKOUT_HOLD_STATES },
            expiresAt: {
              gt: new Date(
                Math.min(
                  startsAt.getTime(),
                  registrationClosesAt?.getTime() ?? Infinity,
                ),
              ),
            },
          },
          data: {
            expiresAt: new Date(
              Math.min(
                startsAt.getTime(),
                registrationClosesAt?.getTime() ?? Infinity,
              ),
            ),
          },
        });
        await promoteWaitlist(tx, id);
      });
    return {
      ok: true,
      message: id
        ? "Event updated. Registered attendees have a saved update notice."
        : "Event created. Registration is open.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function addEvent(data: FormData) {
  return saveEvent(data);
}
export async function cancelEvent(data: FormData) {
  await requireRole(["STAFF"]);
  const eventId = String(data.get("eventId") || "");
  if (data.get("confirm") !== "on")
    return {
      ok: false,
      message:
        "Confirm that attendees will be notified and tickets invalidated.",
    };
  try {
    await eventTransaction(eventId, async (tx) => {
      const event = await tx.event.findUniqueOrThrow({
        where: { id: eventId },
      });
      if (event.cancelledAt || event.startsAt <= new Date())
        throw new Error("Only an upcoming active event can be cancelled.");
      await tx.event.update({
        where: { id: eventId },
        data: { cancelledAt: new Date() },
      });
      const tickets = await tx.ticket.findMany({
        where: { eventId, status: { not: "CANCELLED" } },
      });
      for (const ticket of tickets) {
        await tx.ticket.update({
          where: { id: ticket.id },
          data: { status: "CANCELLED", cancelledAt: new Date(), qrToken: null },
        });
        if (ticket.paymentMode === "RAZORPAY_TEST")
          await tx.payment.updateMany({
            where: {
              ticketId: ticket.id,
              ledgerId: ticket.ledgerId,
              status: "CONFIRMED",
            },
            data: {
              status: "REFUND_REQUIRED",
              issue:
                "Event cancelled. Full test refund requires staff processing.",
            },
          });
        if (ticket.ledgerId && ticket.paymentMode !== "RAZORPAY_TEST")
          await tx.transaction.update({
            where: { id: ticket.ledgerId },
            data: { status: "void" },
          });
      }
      const recipients = new Set(
        tickets.map((t) => t.userId).filter((v): v is string => !!v),
      );
      const holds = await tx.payment.findMany({
        where: { eventId, status: { in: CHECKOUT_HOLD_STATES } },
      });
      for (const hold of holds) recipients.add(hold.userId);
      await tx.payment.updateMany({
        where: { eventId, status: { in: CHECKOUT_HOLD_STATES } },
        data: {
          status: "EXPIRED",
          expiresAt: new Date(0),
          issue:
            "Event cancelled. Recheck any submitted payment; late captures require staff review.",
        },
      });
      for (const entry of await tx.waitlistEntry.findMany({
        where: {
          eventId,
          status: { in: ["WAITING", "OFFERED", "PAYMENT_PENDING"] },
        },
      }))
        recipients.add(entry.userId);
      await tx.waitlistEntry.updateMany({
        where: {
          eventId,
          status: { in: ["WAITING", "OFFERED", "PAYMENT_PENDING"] },
        },
        data: { status: "CLOSED" },
      });
      for (const userId of Array.from(recipients))
        await notify(
          tx,
          userId,
          `event-cancelled:${eventId}:${userId}`,
          "Event cancelled",
          `${event.name} has been cancelled. All entry tickets are invalid. No real refund was processed.`,
          "/my-events",
        );
    });
    return {
      ok: true,
      message:
        "Event cancelled, ticket access revoked, and attendee notices saved.",
    };
  } catch (error) {
    return fail(error);
  }
}
export async function runEventUpdates() {
  await requireRole(["STAFF"]);
  await processEventUpdates();
  const { processMembershipUpdates } = await import("@/server/club-service");
  await processMembershipUpdates();
  return {
    ok: true,
    message:
      "Waitlist offers refreshed and due event/membership reminders saved. Email delivery is a separate step.",
  };
}
