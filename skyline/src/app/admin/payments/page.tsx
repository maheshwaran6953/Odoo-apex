import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/server/auth";
import { gatewayReady } from "@/server/razorpay";
import { PageHeading, money, Empty } from "@/components/club/ui";
import { PaymentStatus } from "@/components/club/payment-status";
export default async function StaffPaymentsPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ status?: string; page?: string; eventId?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const role = await requireRole(["STAFF", "TREASURER"]);
  const statuses = [
    "INIT",
    "CREATING",
    "PENDING",
    "CONFIRMED",
    "FAILED",
    "EXPIRED",
    "REVIEW",
    "REFUND_REQUIRED",
    "REFUND_PENDING",
    "REFUNDED",
  ];
  const status = statuses.includes(searchParams.status || "")
    ? searchParams.status
    : undefined;
  const page = Math.max(
    1,
    Math.min(10000, parseInt(searchParams.page || "1", 10) || 1),
  );
  const where = {
    ...(status ? { status } : {}),
    ...(searchParams.eventId ? { eventId: searchParams.eventId } : {}),
  };
  const [rows, total, review] = await Promise.all([
    db.payment.findMany({
      where,
      include: { event: true, user: true },
      take: 25,
      skip: (page - 1) * 25,
      orderBy: { createdAt: "desc" },
    }),
    db.payment.count({ where }),
    db.payment.count({
      where: {
        status: { in: ["REVIEW", "REFUND_REQUIRED", "REFUND_PENDING"] },
      },
    }),
  ]);
  const query = (p: number) =>
    `?${new URLSearchParams({ status: status || "", eventId: searchParams.eventId || "", page: String(p) })}`;
  return (
    <main>
      <PageHeading
        eyebrow="CHECKOUT OPERATIONS"
        title="Test payment desk"
        description="Reconcile provider records, review late captures and track full test refunds."
      />
      <div className="glass-panel panel mb-5">
        <span className={`badge ${gatewayReady() ? "active" : "danger"}`}>
          {gatewayReady()
            ? "Test keys configured"
            : "Test checkout unavailable — add valid test keys"}
        </span>
        <p className="subtext mt-3">
          {review} payments need review or refund processing. Test entries never
          increase the posted club balance. Open a checkout for server
          reconciliation or full-refund controls.
        </p>
      </div>
      <form className="toolbar">
        <label className="field !mb-0">
          <span>Status</span>
          <select className="input" name="status" defaultValue={status || ""}>
            <option value="">All statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        {searchParams.eventId && (
          <input type="hidden" name="eventId" value={searchParams.eventId} />
        )}
        <button className="button self-end">Apply filter</button>
        <Link className="button secondary self-end" href="/admin/payments">
          Clear filters
        </Link>
      </form>
      <section className="glass-panel panel">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Event / attendee</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Provider references</th>
                <th>Hold deadline / issue</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={
                        role === "STAFF"
                          ? `/events/${p.eventId}/manage`
                          : `/events/${p.eventId}`
                      }
                      className="font-semibold"
                    >
                      {p.event.name}
                    </Link>
                    <p className="subtext">
                      {p.user.name}
                      <br />
                      {p.user.email}
                    </p>
                  </td>
                  <td className="whitespace-nowrap">
                    {money(p.amountCents, p.currency)}
                    <p className="subtext">TEST</p>
                  </td>
                  <td>
                    <PaymentStatus status={p.status} />
                  </td>
                  <td className="text-xs break-all">
                    {p.providerOrderId || "No order response"}
                    <br />
                    {p.providerPaymentId || "No verified capture"}
                  </td>
                  <td className="text-xs max-w-[260px]">
                    {p.expiresAt.toLocaleString()}
                    <p className="subtext mt-2">{p.issue || "—"}</p>
                  </td>
                  <td>
                    <Link
                      className="button small secondary"
                      href={`/payments/${p.id}`}
                    >
                      Review checkout
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <Empty>No checkouts match this view.</Empty>}
        <div className="flex justify-between subtext mt-5">
          <span>
            {total} checkouts · page {page}
          </span>
          <div className="flex gap-4">
            {page > 1 && <Link href={query(page - 1)}>Previous</Link>}
            {page * 25 < total && <Link href={query(page + 1)}>Next</Link>}
          </div>
        </div>
      </section>
    </main>
  );
}
