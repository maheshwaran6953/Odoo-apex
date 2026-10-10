import { db } from "@/lib/db";
import { currentRole, requireRole } from "@/server/auth";
import { createExpense, approveExpense } from "@/server/actions/treasurer";
import { ActionForm } from "@/components/club/action-form";
import { PageHeading, Stat, money, date, Empty } from "@/components/club/ui";
export default async function TreasurerPage() {
  await requireRole(["TREASURER"]);
  const [transactions, role] = await Promise.all([
    db.transaction.findMany({ orderBy: { createdAt: "desc" } }),
    currentRole(),
  ]);
  const income = transactions
    .filter((t) => t.type === "INCOME" && t.status === "posted")
    .reduce((s, t) => s + t.amountCents, 0);
  const expenses = transactions
    .filter((t) => t.type === "EXPENSE" && t.status === "posted")
    .reduce((s, t) => s + t.amountCents, 0);
  const pending = transactions.filter(
    (t) => t.type === "EXPENSE" && t.status === "pending",
  );
  return (
    <main>
      <PageHeading
        eyebrow="THE MONEY, CLEARLY"
        title="Treasurer desk"
        description="A shared ledger for dues, tickets, club orders, and the costs along the way."
      />
      <div className="stats-grid">
        <Stat
          label="Club balance"
          value={money(income - expenses)}
          note="Posted income minus posted expenses"
          dark
        />
        <Stat
          label="Money in"
          value={money(income)}
          note="Dues, tickets and merchandise"
        />
        <Stat
          label="Money out"
          value={money(expenses)}
          note="Approved reimbursements"
        />
        <Stat
          label="Awaiting review"
          value={money(pending.reduce((s, t) => s + t.amountCents, 0))}
          note={`${pending.length} reimbursement requests`}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_310px]">
        <section className="glass-panel panel">
          <div className="panel-heading">
            <h2>Club ledger</h2>
            <span className="badge">{transactions.length} entries</span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Entry</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <strong className="block font-semibold">
                        {t.description}
                      </strong>
                      <span className="subtext capitalize">
                        {t.category.toLowerCase().replaceAll("_", " ")}
                      </span>
                      {t.status === "pending" && role === "TREASURER" && (
                        <ActionForm
                          action={approveExpense.bind(null, t.id)}
                          className="mt-2"
                        >
                          <button className="button secondary small">
                            Approve reimbursement
                          </button>
                        </ActionForm>
                      )}
                    </td>
                    <td className="whitespace-nowrap">{date(t.createdAt)}</td>
                    <td>
                      <span
                        className={`badge ${t.status === "posted" ? "active" : t.status === "void" ? "danger" : "pending"}`}
                      >
                        {t.status === "posted"
                          ? "Posted"
                          : t.status === "void"
                            ? "Voided"
                            : t.status === "test" ? "Razorpay TEST — excluded from balance" : "Pending review"}
                      </span>
                    </td>
                    <td
                      className={`text-right whitespace-nowrap font-semibold ${t.type === "INCOME" ? "text-[#397048]" : "text-[#9b5f46]"}`}
                    >
                      {t.type === "INCOME" ? "+" : "−"}
                      {money(t.amountCents, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!transactions.length && (
            <Empty>
              Your first dues payment or club order will appear here.
            </Empty>
          )}
        </section>
        <section className="glass-panel panel h-fit">
          <h2 className="section-title">Submit an expense</h2>
          <p className="subtext mt-2 mb-5">
            Paid for club supplies? Record the cost for the treasurer to review.
          </p>
          <ActionForm action={createExpense}>
            <label className="field">
              <span>What was it for?</span>
              <input
                className="input"
                name="description"
                required
                minLength={3}
                maxLength={200}
                placeholder="Ingredients for the bake sale"
              />
            </label>
            <label className="field">
              <span>Amount ($)</span>
              <input
                className="input"
                name="amount"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required
                placeholder="24.50"
              />
            </label>
            <button className="button w-full">Submit for review</button>
          </ActionForm>
          <p className="subtext mt-4">
            Pending requests do not change the balance until approved. Keep your
            receipt for the committee.
          </p>
        </section>
      </div>
    </main>
  );
}
