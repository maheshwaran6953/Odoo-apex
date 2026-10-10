import { loadEnvConfig } from "@next/env";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

async function main() {
  if (!process.argv.includes("--temporary-fixtures"))
    throw new Error(
      "Pass --temporary-fixtures to allow isolated test records.",
    );
  loadEnvConfig(process.cwd());
  const { db } = await import("../src/lib/db");
  const {
    eventTransaction,
    registerAttendee,
    cancelTicketRegistration,
    bookingOpen,
  } = await import("../src/server/events-service");
  const { moneyCents, validEmail, validName } =
    await import("../src/lib/validation");
  const tag = `event-check-${randomUUID()}`;
  const userIds: string[] = [],
    eventIds: string[] = [],
    memberIds: string[] = [];
  const ledgerIds: string[] = [];
  const future = new Date(Date.now() + 86400000);
  const register = (eventId: string, userId: string) =>
    eventTransaction(eventId, (tx) => registerAttendee(tx, eventId, userId));
  const newEvent = async (capacity: number) => {
    const event = await db.event.create({
      data: {
        name: tag,
        description: "Isolated integrity fixture; no payment collected.",
        location: "Fixture only",
        startsAt: future,
        capacity,
        memberPriceCents: 1000,
        nonMemberPriceCents: 1500,
        paymentMode: "PRACTICE",
        currency: "USD",
      },
    });
    eventIds.push(event.id);
    return event;
  };
  try {
    for (let i = 0; i < 5; i++) {
      const user = await db.user.create({
        data: {
          name: "Event fixture",
          email: `${tag}-${i}@example.test`,
          passwordHash: "fixture-disabled-password",
          role: "MEMBER",
          approvalStatus: "APPROVED",
          emailVerifiedAt: i === 2 ? null : new Date(),
          disabledAt: i === 3 ? new Date() : null,
          emailReminders: false,
        },
      });
      userIds.push(user.id);
    }
    const seat = await newEvent(1);
    const outcomes = await Promise.allSettled(
      userIds.slice(0, 2).map((id) => register(seat.id, id)),
    );
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
    const winner = outcomes.find(
      (x) => x.status === "fulfilled",
    ) as PromiseFulfilledResult<Awaited<ReturnType<typeof register>>>;
    assert.equal(
      await db.ticket.count({
        where: { eventId: seat.id, status: { not: "CANCELLED" } },
      }),
      1,
    );
    assert.equal(winner.value.priceCents, 1500);
    await assert.rejects(
      register(seat.id, winner.value.userId!),
      /already have/,
    );
    console.log(
      "PASS: concurrent final seat, unique registration and nonmember price",
    );
    const eligibility = await newEvent(5);
    await assert.rejects(
      register(eligibility.id, userIds[2]),
      /Verify your email/,
    );
    await assert.rejects(
      register(eligibility.id, userIds[3]),
      /Verify your email/,
    );
    await db.user.update({
      where: { id: userIds[4] },
      data: { approvalStatus: "PENDING" },
    });
    await assert.rejects(
      register(eligibility.id, userIds[4]),
      /Verify your email/,
    );
    assert.equal(
      await db.ticket.count({ where: { eventId: eligibility.id } }),
      0,
    );
    console.log(
      "PASS: unverified, disabled and unapproved accounts cannot register",
    );
    await eventTransaction(seat.id, (tx) =>
      cancelTicketRegistration(tx, winner.value.id),
    );
    const cancelled = await db.ticket.findUniqueOrThrow({
      where: { id: winner.value.id },
    });
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.qrToken, null);
    assert.equal(
      (
        await db.transaction.findUniqueOrThrow({
          where: { id: cancelled.ledgerId! },
        })
      ).status,
      "void",
    );
    await assert.rejects(
      eventTransaction(seat.id, (tx) =>
        cancelTicketRegistration(tx, winner.value.id),
      ),
      /already cancelled/,
    );
    await register(
      seat.id,
      userIds.find(
        (id) =>
          id !== winner.value.userId && [userIds[0], userIds[1]].includes(id),
      )!,
    );
    console.log(
      "PASS: cancellation revokes QR, voids practice income and releases the seat",
    );
    const member = await db.member.create({
      data: {
        name: "Fixture active member",
        email: `${tag}-membership@example.test`,
        membership: {
          create: { status: "ACTIVE", duesCents: 1000, expiresAt: future },
        },
      },
    });
    memberIds.push(member.id);
    await db.user.update({
      where: { id: userIds[4] },
      data: { approvalStatus: "APPROVED", memberId: member.id },
    });
    const memberTicket = await register(eligibility.id, userIds[4]);
    assert.equal(memberTicket.priceCents, 1000);
    assert.equal(memberTicket.type, "MEMBER");
    await eventTransaction(eligibility.id, (tx) =>
      cancelTicketRegistration(tx, memberTicket.id),
    );
    await db.membership.update({
      where: { memberId: member.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expiredTicket = await register(eligibility.id, userIds[4]);
    assert.equal(expiredTicket.priceCents, 1500);
    assert.equal(expiredTicket.type, "NON_MEMBER");
    console.log(
      "PASS: active membership discount and expired membership guest price",
    );
    for (const [input, expected] of [
      ["", null],
      ["-1", null],
      ["1.001", null],
      ["1e2", null],
      ["100001", null],
      ["0", null],
      ["0.01", 1],
      ["1.01", 101],
    ] as const)
      assert.equal(moneyCents(input), expected);
    assert.equal(moneyCents("0", true), 0);
    assert.equal(validEmail("bad@"), false);
    assert.equal(validName("a\nb"), false);
    assert.equal(
      bookingOpen({
        startsAt: future,
        registrationClosesAt: null,
        cancelledAt: null,
      }),
      true,
    );
    assert.equal(
      bookingOpen({
        startsAt: future,
        registrationClosesAt: new Date(Date.now() - 1000),
        cancelledAt: null,
      }),
      false,
    );
    assert.equal(
      bookingOpen({
        startsAt: new Date(Date.now() - 1000),
        registrationClosesAt: null,
        cancelledAt: null,
      }),
      false,
    );
    assert.equal(
      bookingOpen({
        startsAt: future,
        registrationClosesAt: null,
        cancelledAt: new Date(),
      }),
      false,
    );
    console.log(
      "PASS: money/name/email validation and event/deadline/cancellation date boundaries",
    );
  } finally {
    // Exact fixture identifiers only. No production reset and no broad category deletes.
    const tickets = await db.ticket.findMany({
      where: { eventId: { in: eventIds } },
      select: { ledgerId: true },
    });
    for (const t of tickets) if (t.ledgerId) ledgerIds.push(t.ledgerId);
    // A re-registration replaces ledgerId; find its historical ledger by exact fixture descriptions.
    const history = await db.transaction.findMany({
      where: { description: `${tag} registration — simulated payment` },
      select: { id: true },
    });
    ledgerIds.push(...history.map((x) => x.id));
    await db.ticket.deleteMany({ where: { eventId: { in: eventIds } } });
    await db.waitlistEntry.deleteMany({ where: { eventId: { in: eventIds } } });
    await db.notification.deleteMany({ where: { userId: { in: userIds } } });
    await db.event.deleteMany({ where: { id: { in: eventIds } } });
    await db.transaction.deleteMany({ where: { id: { in: ledgerIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.membership.deleteMany({ where: { memberId: { in: memberIds } } });
    await db.member.deleteMany({ where: { id: { in: memberIds } } });
    assert.equal(await db.user.count({ where: { id: { in: userIds } } }), 0);
    assert.equal(await db.event.count({ where: { id: { in: eventIds } } }), 0);
    console.log("PASS: isolated fixtures cleaned");
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Event verification failed",
  );
  process.exitCode = 1;
});
