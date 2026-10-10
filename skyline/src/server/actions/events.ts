"use server";
import { db } from "@/lib/db";
import { requireUser, requireRole } from "@/server/auth";
import {
  eventTransaction,
  registerAttendee,
  promoteWaitlist,
  bookingOpen,
  notify,
  processEventUpdates,
} from "@/server/events-service";

function fail(error: unknown) {
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
      if (existing && ["WAITING", "OFFERED"].includes(existing.status))
        throw new Error("You are already on the waitlist.");
      const sold = await tx.ticket.count({
        where: { eventId, status: { not: "CANCELLED" } },
      });
      const offers = await tx.waitlistEntry.count({
        where: { eventId, status: "OFFERED" },
      });
      if (sold + offers < event.capacity)
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
      if (ticket.ledgerId)
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
          `${ticket.event.name}: your place was released. ${ticket.ledgerId ? "The linked simulated income entry was voided." : "This legacy ticket has no linked income entry; ask the treasurer to reconcile its record."} No real refund was processed.`,
          "/my-events",
        );
      await promoteWaitlist(tx, existing.eventId);
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
  const saved = await db.ticket.updateMany({
    where: { id: ticket.id, status: "PAID", event: { cancelledAt: null } },
    data: { status: "CHECKED_IN", checkedInAt: new Date() },
  });
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
  const memberPrice = Number(data.get("memberPrice"));
  const guestPrice = Number(data.get("guestPrice"));
  if (
    name.length < 3 ||
    name.length > 100 ||
    description.length < 10 ||
    description.length > 3000 ||
    !location ||
    location.length > 200 ||
    schedule.length > 3000 ||
    (organizerEmail && !/^\S+@\S+\.\S+$/.test(organizerEmail)) ||
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
        "Check event details, future dates, capacity, contact email, and non-negative prices.",
    };
  const fields = {
    name,
    description,
    location,
    schedule,
    organizerEmail: organizerEmail || null,
    startsAt,
    registrationClosesAt,
    capacity,
    memberPriceCents: Math.round(memberPrice * 100),
    nonMemberPriceCents: Math.round(guestPrice * 100),
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
        if (capacity < registered + offers)
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
            where: { eventId: id, status: { in: ["WAITING", "OFFERED"] } },
          }))
            recipients.add(entry.userId);
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
        if (ticket.ledgerId)
          await tx.transaction.update({
            where: { id: ticket.ledgerId },
            data: { status: "void" },
          });
      }
      const recipients = new Set(
        tickets.map((t) => t.userId).filter((v): v is string => !!v),
      );
      for (const entry of await tx.waitlistEntry.findMany({
        where: { eventId, status: { in: ["WAITING", "OFFERED"] } },
      }))
        recipients.add(entry.userId);
      await tx.waitlistEntry.updateMany({
        where: { eventId, status: { in: ["WAITING", "OFFERED"] } },
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
  return {
    ok: true,
    message:
      "Waitlist offers refreshed and due event reminders saved. Email delivery is a separate step.",
  };
}
