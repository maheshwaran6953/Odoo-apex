import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { TicketQR } from "@/components/club/ticket-qr";
import { ActionForm } from "@/components/club/action-form";
import { cancelRegistration } from "@/server/actions/events";
import { PageHeading, money } from "@/components/club/ui";
export default async function TicketPage({
  params,
}: {
  params: { ticketId: string };
}) {
  const user = await requireUser();
  const ticket = await db.ticket.findUnique({
    where: { id: params.ticketId },
    include: { event: true, payments: { orderBy: { createdAt: "desc" } } },
  });
  if (!ticket || (ticket.userId !== user.id && user.role !== "STAFF"))
    notFound();
  const valid = ticket.status === "PAID" && !ticket.event.cancelledAt;
  return (
    <main>
      <Link className="section-link mb-5" href="/my-events">
        ← My events
      </Link>
      <PageHeading
        eyebrow="YOUR ENTRY PASS"
        title={ticket.event.name}
        description={`${ticket.event.startsAt.toLocaleString()} · ${ticket.event.location}`}
      />
      <section className="glass-panel panel max-w-[640px] mx-auto printable-ticket">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="eyebrow">SKYLINE STUDENT ASSOCIATION</p>
            <h2 className="section-title">
              {ticket.attendeeName || "Legacy guest ticket"}
            </h2>
          </div>
          <span className={`badge ${valid ? "active" : "danger"}`}>
            {valid
              ? "Registered"
              : ticket.status === "CHECKED_IN"
                ? "Already attended"
                : "Not valid for entry"}
          </span>
        </div>
        {valid && ticket.qrToken ? (
          <TicketQR token={ticket.qrToken} code={ticket.code} />
        ) : (
          <p className="form-feedback">
            {ticket.status === "CHECKED_IN"
              ? `Checked in ${ticket.checkedInAt?.toLocaleString()}. This ticket cannot be reused.`
              : ticket.status === "CANCELLED"
                ? "Registration cancelled. This QR has been revoked."
                : "This older ticket has a backup code only."}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-5 border-t border-black/5 mt-6 pt-5 text-sm">
          <div>
            <dt className="subtext">Attendee</dt>
            <dd>{ticket.attendeeName || "Guest"}</dd>
          </div>
          <div>
            <dt className="subtext">Ticket category</dt>
            <dd>
              {ticket.type === "MEMBER"
                ? "Active member"
                : "Guest / non-member"}
            </dd>
          </div>
          <div>
            <dt className="subtext">Recorded price</dt>
            <dd>
              {money(ticket.priceCents, ticket.currency)} ·{" "}
              {ticket.paymentMode === "RAZORPAY_TEST"
                ? "Razorpay TEST payment"
                : "simulated payment"}
            </dd>
          </div>
          <div>
            <dt className="subtext">Entry code</dt>
            <dd className="break-all">{ticket.code}</dd>
          </div>
        </dl>
        <div className="flex gap-3 mt-5 print:hidden">
          {ticket.payments[0] && (
            <Link
              className="button secondary"
              href={`/payments/${ticket.payments[0].id}`}
            >
              Payment & refund status
            </Link>
          )}
          <Link className="button secondary" href={`/events/${ticket.eventId}`}>
            Event details
          </Link>
          <a
            className="button secondary"
            href={`/api/events/${ticket.eventId}/calendar`}
          >
            Add to calendar
          </a>
        </div>
      </section>
      {valid && ticket.event.startsAt > new Date() && (
        <details className="disclosure max-w-[640px] mx-auto mt-6 print:hidden">
          <summary>Can’t make it? Cancel your registration</summary>
          <ActionForm action={cancelRegistration}>
            <input type="hidden" name="ticketId" value={ticket.id} />
            <p className="subtext mb-4">
              This revokes your ticket and releases your place to the waitlist.
              {ticket.paymentMode === "RAZORPAY_TEST"
                ? "Your test refund will require separate staff processing and provider confirmation. No real funds are involved."
                : "No real payment or refund is involved."}
            </p>
            <button className="button secondary">
              Cancel registration & release seat
            </button>
          </ActionForm>
        </details>
      )}
    </main>
  );
}
