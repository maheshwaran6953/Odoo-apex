import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { PageHeading, money, Empty } from "@/components/club/ui";
import { PaymentStatus } from "@/components/club/payment-status";
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(
    1,
    Math.min(10000, parseInt(searchParams.page || "1", 10) || 1),
  );
  const total = await db.payment.count({ where: { userId: user.id } });
  const rows = await db.payment.findMany({
    where: { userId: user.id },
    include: { event: true },
    orderBy: { createdAt: "desc" },
    take: 20,
    skip: (page - 1) * 20,
  });
  return (
    <main>
      <PageHeading
        eyebrow="NO GUESSWORK ABOUT CHECKOUT"
        title="My payments"
        description="Your Razorpay test checkouts, seat holds and refund outcomes."
        action={
          <Link href="/events" className="button">
            Browse events
          </Link>
        }
      />
      <section className="glass-panel panel">
        <p className="subtext mb-5">
          Test Mode payments do not move real money. Practice registrations
          remain in My events.
        </p>
        {rows.map((p) => (
          <article key={p.id} className="row-list flex-wrap">
            <div className="flex-1 min-w-[180px]">
              <h2 className="font-semibold">{p.event.name}</h2>
              <p className="subtext mt-1">
                {p.createdAt.toLocaleString()} ·{" "}
                {money(p.amountCents, p.currency)}
              </p>
              <PaymentStatus status={p.status} />
            </div>
            <Link className="button small secondary" href={`/payments/${p.id}`}>
              View checkout & status
            </Link>
          </article>
        ))}
        {!rows.length && (
          <Empty>
            No test checkouts yet. Choose an event with Razorpay Test Mode
            enabled to begin.
          </Empty>
        )}
        <div className="flex gap-4 justify-between mt-5 subtext">
          <span>
            {total} checkouts · page {page}
          </span>
          <div className="flex gap-4">
            {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
            {page * 20 < total && <Link href={`?page=${page + 1}`}>Next</Link>}
          </div>
        </div>
      </section>
    </main>
  );
}
