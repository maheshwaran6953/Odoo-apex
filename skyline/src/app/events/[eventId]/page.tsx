import { clubDateTime, clubTimeZone } from "@/lib/dates";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser } from "@/server/auth";
import { hasClubAccess } from "@/lib/access";
import {
  purchaseTicket,
  joinWaitlist,
  leaveWaitlist,
} from "@/server/actions/events";
import { bookingOpen } from "@/server/events-service";
import { ActionForm } from "@/components/club/action-form";
import { PageHeading, money, date } from "@/components/club/ui";
import { startEventCheckout } from "@/server/actions/payments";
import { gatewayReady } from "@/server/razorpay";
export default async function EventPage({
  params: paramsPromise,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const params = await paramsPromise;
  const [event, user] = await Promise.all([
    db.event.findUnique({
      where: { id: params.eventId },
      include: {
        tickets: { select: { status: true } },
        payments: {
          where: {
            status: { in: ["INIT", "CREATING", "PENDING"] },
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        },
        waitlist: {
          where: { status: "OFFERED", offerExpiresAt: { gt: new Date() } },
          select: { id: true },
        },
      },
    }),
    currentUser(),
  ]);
  if (!event) notFound();
  const ownTicket = user
    ? await db.ticket.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
      })
    : null;
  const ownWait = user
    ? await db.waitlistEntry.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
      })
    : null;
  const sold = event.tickets.filter((t) => t.status !== "CANCELLED").length;
  const seats = Math.max(
    0,
    event.capacity - sold - event.waitlist.length - event.payments.length,
  );
  const ownCheckout = user
    ? await db.payment.findFirst({
        where: {
          eventId: event.id,
          userId: user.id,
          status: {
            in: [
              "INIT",
              "CREATING",
              "PENDING",
              "REVIEW",
              "REFUND_REQUIRED",
              "REFUND_PENDING",
            ],
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : null;
  const offer =
    ownWait?.status === "OFFERED" &&
    !!ownWait.offerExpiresAt &&
    ownWait.offerExpiresAt > new Date();
  const registered = ownTicket && ownTicket.status !== "CANCELLED";
  const open = bookingOpen(event);
  const position =
    ownWait?.status === "WAITING"
      ? await db.waitlistEntry.count({
          where: {
            eventId: event.id,
            status: "WAITING",
            OR: [
              { createdAt: { lt: ownWait.createdAt } },
              { createdAt: ownWait.createdAt, id: { lte: ownWait.id } },
            ],
          },
        })
      : null;
  return (
    <main>
      <Link href="/events" className="section-link mb-5">
        ← All events
      </Link>
      <PageHeading
        eyebrow="YOUR INVITATION"
        title={event.name}
        description={event.description}
        action={
          hasClubAccess(user, ["STAFF"]) ? (
            <Link className="button" href={`/events/${event.id}/manage`}>
              Manage event
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="glass-panel overflow-hidden">
          <div className="event-art !min-h-[240px]">
            <span className="poster-title !text-5xl">{event.name}</span>
            <span
              className={`badge ${event.cancelledAt ? "danger" : "active"}`}
            >
              {event.cancelledAt
                ? "Cancelled"
                : open
                  ? "Upcoming gathering"
                  : "Registration closed"}
            </span>
          </div>
          <div className="panel">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <h2 className="section-title">When</h2>
                <p className="mt-2">
                  {event.startsAt.toLocaleString("en-GB", {
                    timeZone: clubTimeZone,
                    dateStyle: "full",
                    timeStyle: "short",
                  })}
                </p>
                <p className="subtext">
                  Time shown in {clubTimeZone}. Calendar download preserves your
                  local time.
                </p>
              </div>
              <div>
                <h2 className="section-title">Where</h2>
                <p className="mt-2">{event.location}</p>
                {event.organizerEmail && (
                  <a
                    className="section-link mt-2"
                    href={`mailto:${event.organizerEmail}`}
                  >
                    Ask the organizer
                  </a>
                )}
              </div>
            </div>
            <div className="border-t border-black/5 pt-5 mt-6">
              <h2 className="section-title">The plan for the day</h2>
              <p className="subtext whitespace-pre-line mt-2">
                {event.schedule ||
                  "The organizer will share the schedule here."}
              </p>
            </div>
            <div className="border-t border-black/5 pt-5 mt-6">
              <h2 className="section-title">A few things to know</h2>
              <ul className="subtext list-disc pl-4 mt-2 space-y-2">
                <li>
                  One registration per verified account. Active linked
                  memberships receive the member price.
                </li>
                <li>
                  Bring your QR ticket or backup code. Entry is valid for this
                  event only.
                </li>
                <li>
                  You can cancel before the event starts, unless already checked
                  in.
                </li>
                <li>
                  Waitlist offers reserve one seat for up to two hours. Check My
                  updates for your offer.
                </li>
              </ul>
            </div>
            <a
              href={`/api/events/${event.id}/calendar`}
              className="button secondary mt-5"
            >
              Add to calendar
            </a>
          </div>
        </section>
        <section className="glass-panel panel h-fit">
          <h2 className="section-title">
            {registered
              ? "You’re on the list"
              : offer
                ? "A seat is held for you"
                : !open
                  ? "Registration closed"
                  : !seats
                    ? "Join the waitlist"
                    : "Book your place"}
          </h2>
          <p className="subtext mt-2">
            {sold} registered · {seats} seats available ·{" "}
            {event.waitlist.length} held for offers · {event.payments.length}{" "}
            checkout holds
          </p>
          {event.registrationClosesAt && (
            <p className="subtext mt-2">
              Deadline: {clubDateTime(event.registrationClosesAt)}
            </p>
          )}
          <div className="space-y-3 py-5 my-4 border-y border-black/5">
            <div className="flex justify-between text-sm">
              <span>Active member</span>
              <strong>{money(event.memberPriceCents, event.currency)}</strong>
            </div>
            <div className="flex justify-between text-sm">
              <span>Guest / non-member</span>
              <strong>
                {money(event.nonMemberPriceCents, event.currency)}
              </strong>
            </div>
          </div>
          {registered ? (
            <Link className="button w-full" href={`/tickets/${ownTicket.id}`}>
              View my QR ticket
            </Link>
          ) : !user ? (
            <Link href="/login" className="button w-full">
              Sign in to register
            </Link>
          ) : !user.emailVerifiedAt ? (
            <div>
              <p className="subtext">
                Verify your email with the latest OTP before booking. Role
                approval by the designated Staff account is a separate step.
              </p>
              <Link className="button mt-3" href="/account">
                Manage verification
              </Link>
            </div>
          ) : user.approvalStatus !== "APPROVED" ? (
            <div>
              <p className="subtext">
                Your requested role must be approved before registration or
                waitlist access.
              </p>
              <Link className="button mt-3" href="/access-status">
                View approval status
              </Link>
            </div>
          ) : ownCheckout ? (
            <Link
              className="button w-full"
              href={`/payments/${ownCheckout.id}`}
            >
              Open my checkout & payment status
            </Link>
          ) : !open ? (
            <p className="subtext">
              {event.cancelledAt
                ? "This event was cancelled. Your updates have the details."
                : "New registrations are no longer accepted."}
            </p>
          ) : ownWait?.status === "WAITING" ? (
            <div>
              <p className="text-sm mb-4">
                Your waitlist position: <strong>{position}</strong>
              </p>
              <ActionForm action={leaveWaitlist}>
                <input type="hidden" name="eventId" value={event.id} />
                <button className="button secondary">Leave waitlist</button>
              </ActionForm>
            </div>
          ) : seats > 0 || offer ? (
            <ActionForm
              action={
                event.paymentMode === "RAZORPAY_TEST"
                  ? startEventCheckout
                  : purchaseTicket
              }
            >
              <input type="hidden" name="eventId" value={event.id} />
              <p className="text-sm mb-4">
                Registering as <strong>{user.name}</strong>
                <br />
                <span className="subtext">{user.email}</span>
              </p>
              {offer && (
                <p className="form-feedback success mb-4">
                  Confirm by {clubDateTime(ownWait!.offerExpiresAt!)}.
                </p>
              )}
              <label className="field">
                <span>Contact phone (optional)</span>
                <input
                  className="input"
                  name="phone"
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                />
              </label>
              {event.paymentMode === "RAZORPAY_TEST" && !gatewayReady() && (
                <p className="form-feedback failure mb-4">
                  Test checkout is not configured yet. Ask staff to add Razorpay
                  test keys. No payment or registration will be made.
                </p>
              )}
              <button
                className="button w-full"
                disabled={
                  event.paymentMode === "RAZORPAY_TEST" && !gatewayReady()
                }
              >
                {event.paymentMode === "RAZORPAY_TEST"
                  ? "Reserve seat & open test checkout"
                  : offer
                    ? "Claim my seat"
                    : "Confirm registration"}
              </button>
            </ActionForm>
          ) : (
            <ActionForm action={joinWaitlist}>
              <input type="hidden" name="eventId" value={event.id} />
              <p className="subtext mb-4">
                Offers follow joining order. No seat or payment is taken when
                you join.
              </p>
              <button className="button w-full">Join waitlist</button>
            </ActionForm>
          )}
          <p className="subtext mt-4">
            {event.paymentMode === "RAZORPAY_TEST"
              ? "Razorpay Test Mode · No real money charged. Seat held for up to 10 minutes; QR issued only after captured-payment verification."
              : "Practice payment · No money is charged."}
          </p>
        </section>
      </div>
    </main>
  );
}
