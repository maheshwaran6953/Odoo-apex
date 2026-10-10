import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { gatewayReady } from "@/server/razorpay";
import { CHECKOUT_HOLD_STATES } from "@/server/events-service";
import {
  recheckPayment,
  releaseCheckout,
  refundTestPayment,
} from "@/server/actions/payments";
import { PageHeading, money } from "@/components/club/ui";
import { PaymentStatus } from "@/components/club/payment-status";
import { ActionForm } from "@/components/club/action-form";
import { RazorpayCheckout } from "@/components/club/razorpay-checkout";
export default async function PaymentPage({
  params,
}: {
  params: { paymentId: string };
}) {
  const user = await requireUser();
  const payment = await db.payment.findUnique({
    where: { id: params.paymentId },
    include: { event: true },
  });
  const staff = ["STAFF", "TREASURER"].includes(user.role);
  if (!payment || (payment.userId !== user.id && !staff)) notFound();
  const owns = payment.userId === user.id;
  const active =
    CHECKOUT_HOLD_STATES.includes(payment.status) &&
    payment.expiresAt > new Date();
  return (
    <main>
      <Link href="/payments" className="section-link mb-5">
        ← My payments
      </Link>
      <PageHeading
        eyebrow="YOUR PLACE, CAREFULLY RESERVED"
        title={payment.event.name}
        description="Razorpay Test Mode checkout and server-verified payment status."
      />
      <section className="glass-panel panel max-w-[720px] mx-auto">
        <div className="flex justify-between gap-3 flex-wrap">
          <PaymentStatus status={payment.status} />
          <span className="badge">TEST MODE · NO REAL FUNDS</span>
        </div>
        <p className="text-4xl font-semibold mt-6">
          {money(payment.amountCents, payment.currency)}
        </p>
        <p className="subtext mt-2">
          {payment.ticketType === "MEMBER"
            ? "Active member price"
            : "Guest price"}{" "}
          · one event ticket · price fixed for this attempt
        </p>
        <dl className="grid gap-4 sm:grid-cols-2 mt-6 mb-6 border-y border-black/5 py-5 text-sm">
          <div>
            <dt className="subtext">Checkout reference</dt>
            <dd className="break-all">{payment.id}</dd>
          </div>
          <div>
            <dt className="subtext">Hold deadline</dt>
            <dd>{payment.expiresAt.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="subtext">Razorpay order</dt>
            <dd className="break-all">
              {payment.providerOrderId || "Not yet confirmed by provider"}
            </dd>
          </div>
          <div>
            <dt className="subtext">Razorpay payment</dt>
            <dd className="break-all">
              {payment.providerPaymentId || "Not captured/verified yet"}
            </dd>
          </div>
          {payment.providerRefundId && (
            <div>
              <dt className="subtext">Refund reference</dt>
              <dd className="break-all">{payment.providerRefundId}</dd>
            </div>
          )}
        </dl>
        {payment.issue && (
          <p className="form-feedback failure mb-5" role="status">
            {payment.issue}
          </p>
        )}
        {!gatewayReady() && (
          <p className="form-feedback failure mb-5">
            Razorpay test keys are not configured or are not valid Test Mode
            keys. Payment controls are unavailable; no charge was made by this
            page.
          </p>
        )}
        {owns && active && (
          <RazorpayCheckout
            paymentId={payment.id}
            expiresAt={payment.expiresAt.toISOString()}
            available={
              payment.status === "PENDING" &&
              !!payment.providerOrderId &&
              gatewayReady()
            }
          />
        )}
        {payment.status === "CONFIRMED" && payment.ticketId && (
          <Link href={`/tickets/${payment.ticketId}`} className="button">
            Open confirmed QR ticket
          </Link>
        )}
        <div className="flex flex-wrap gap-3 mt-5">
          <ActionForm action={recheckPayment}>
            <input type="hidden" name="paymentId" value={payment.id} />
            <button className="button secondary">Recheck payment status</button>
          </ActionForm>
          <Link
            href={`/events/${payment.eventId}`}
            className="button secondary"
          >
            Event details
          </Link>
          {staff && (
            <Link href="/admin/payments" className="button secondary">
              Staff payment desk
            </Link>
          )}
        </div>
        {owns && active && (
          <details className="disclosure mt-6">
            <summary>Release this checkout hold</summary>
            <ActionForm action={releaseCheckout}>
              <input type="hidden" name="paymentId" value={payment.id} />
              <label className="flex gap-2 text-sm mb-4">
                <input type="checkbox" name="confirm" required />I understand
                this releases my seat. A submitted payment arriving later will
                require staff review.
              </label>
              <button className="button secondary">Release seat hold</button>
            </ActionForm>
          </details>
        )}
        {staff &&
          payment.providerPaymentId &&
          ["REVIEW", "REFUND_REQUIRED", "REFUND_PENDING"].includes(
            payment.status,
          ) && (
            <details className="disclosure mt-6">
              <summary>Process full test refund</summary>
              <ActionForm action={refundTestPayment}>
                <input type="hidden" name="paymentId" value={payment.id} />
                <label className="flex gap-2 text-sm mb-4">
                  <input type="checkbox" name="confirm" required />
                  Confirm full TEST refund of{" "}
                  {money(payment.amountCents, payment.currency)}. This does not
                  involve real funds.
                </label>
                <button className="button secondary">
                  Submit / reconcile full test refund
                </button>
              </ActionForm>
            </details>
          )}
        <p className="subtext mt-6">
          Closing a browser or checkout does not prove payment failed. Use
          Recheck payment status before starting another payment. Cancellation
          releases entry access; refunds are confirmed separately.
        </p>
      </section>
    </main>
  );
}
