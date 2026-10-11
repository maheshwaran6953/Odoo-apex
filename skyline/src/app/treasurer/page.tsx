import Link from "next/link";
import { FinanceFilterForm } from "@/components/club/finance-filters";
import { financeFilters, financeWhere } from "@/server/finance-report-service";
import { randomUUID } from "node:crypto";
import { financeSummary } from "@/server/finance-service";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/server/auth";
import {
  approveExpense,
  rejectExpense,
  createFundraiserIncome,
} from "@/server/actions/treasurer";
import { ActionForm } from "@/components/club/action-form";
import { ExpenseForm } from "@/components/club/expense-section";
import { PageHeading, Stat, money, date, Empty } from "@/components/club/ui";

export default async function TreasurerPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const searchParams = await searchParamsPromise;
  await requireRole(["TREASURER"]);
  const user = await requireUser();
  let filters = financeFilters({});
  let filterError = "";
  try {
    filters = financeFilters(searchParams);
  } catch (error) {
    filterError = (error as Error).message;
  }
  if (filterError)
    return (
      <main>
        <PageHeading
          eyebrow="THE MONEY, CLEARLY"
          title="Treasurer desk"
          description="Correct the filters to view the ledger."
        />
        <FinanceFilterForm filters={filters} error={filterError} />
      </main>
    );
  const rawPage = searchParams.page ?? "1";
  const pageNumber =
    typeof rawPage === "string" && /^[1-9]\d{0,5}$/.test(rawPage)
      ? Number(rawPage)
      : 1;
  const transactions = await db.transaction.findMany({
    where: financeWhere(filters),
    take: 10001,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  if (transactions.length > 10000)
    return (
      <main>
        <PageHeading
          eyebrow="THE MONEY, CLEARLY"
          title="Treasurer desk"
          description="Narrow the report to see complete totals."
        />
        <FinanceFilterForm
          filters={filters}
          error="More than 10,000 entries match. Choose a narrower date range."
        />
      </main>
    );
  const pageCount = Math.max(1, Math.ceil(transactions.length / 25));
  const activePage = Math.min(pageNumber, pageCount);
  const displayed = transactions.slice((activePage - 1) * 25, activePage * 25);
  const pageHref = (page: number) =>
    "/treasurer?" +
    new URLSearchParams({ ...filters, page: String(page) }).toString();
  const personIds = Array.from(
    new Set(
      transactions.flatMap((t) =>
        [t.claimantId, t.reviewedById].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    ),
  );
  const people = await db.user.findMany({
    where: { id: { in: personIds } },
    select: { id: true, name: true, email: true },
  });
  const names = new Map(people.map((person) => [person.id, person]));
  const currencies = Array.from(
    new Set(transactions.map((t) => t.currency)),
  ).sort();
  return (
    <main>
      <PageHeading
        eyebrow="THE MONEY, CLEARLY"
        title="Treasurer desk"
        description="Review reimbursement requests and track posted income and expenses separately by currency."
      />
      <FinanceFilterForm filters={filters} />
      {!currencies.length && (
        <Empty>
          No financial activity yet. Your first club transaction will appear
          here.
        </Empty>
      )}
      {currencies.map((currency) => {
        const { income, expenses, pendingCount, pendingAmount } =
          financeSummary(transactions, currency);
        return (
          <section
            key={currency}
            aria-label={`${currency} financial summary`}
            className="mb-5"
          >
            <h2 className="section-title mb-3">{currency} ledger</h2>
            <div className="stats-grid">
              <Stat
                label="Filtered balance"
                value={money(income - expenses, currency)}
                note="Matching posted income minus matching posted expenses"
                dark
              />
              <Stat
                label="Money in"
                value={money(income, currency)}
                note="Posted income only; test payments excluded"
              />
              <Stat
                label="Money out"
                value={money(expenses, currency)}
                note="Approved expenses; not proof of bank transfer"
              />
              <Stat
                label="Awaiting review"
                value={money(pendingAmount, currency)}
                note={`${pendingCount} requests; excluded from balance`}
              />
            </div>
          </section>
        );
      })}
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
                  <th>Entry and claimant</th>
                  <th>Date</th>
                  <th>Status and review</th>
                  <th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((t) => {
                  const claimant = t.claimantId
                    ? names.get(t.claimantId)
                    : null;
                  const reviewer = t.reviewedById
                    ? names.get(t.reviewedById)
                    : null;
                  const reviewable =
                    t.type === "EXPENSE" &&
                    t.category === "REIMBURSEMENT" &&
                    t.status === "pending";
                  return (
                    <tr key={t.id}>
                      <td>
                        <strong className="block font-semibold">
                          {t.description}
                        </strong>
                        <span className="subtext capitalize">
                          {t.category.toLowerCase().replaceAll("_", " ")}
                        </span>
                        {t.type === "EXPENSE" && (
                          <p className="subtext mt-1">
                            Claimant:{" "}
                            {claimant
                              ? `${claimant.name} (${claimant.email})`
                              : "Not recorded"}
                          </p>
                        )}
                        {(t.receiptPath || t.receiptUrl) && (
                          <a
                            className="section-link block mt-2"
                            href={
                              t.receiptPath
                                ? "/api/receipts/" + t.id
                                : t.receiptUrl!
                            }
                            target={t.receiptPath ? undefined : "_blank"}
                            download={
                              t.receiptPath ? t.receiptName || true : undefined
                            }
                            rel="noopener noreferrer"
                          >
                            Open receipt
                          </a>
                        )}
                        {reviewable &&
                          t.claimantId &&
                          t.claimantId !== user.id && (
                            <div className="mt-2 space-y-2">
                              <ActionForm
                                action={approveExpense.bind(null, t.id)}
                              >
                                <button className="button secondary small">
                                  Approve reimbursement
                                </button>
                              </ActionForm>
                              <ActionForm
                                action={rejectExpense.bind(null, t.id)}
                              >
                                <label className="field">
                                  <span>Reason for rejection</span>
                                  <input
                                    className="input"
                                    name="reason"
                                    required
                                    minLength={3}
                                    maxLength={300}
                                  />
                                </label>
                                <button className="button secondary small">
                                  Reject request
                                </button>
                              </ActionForm>
                            </div>
                          )}
                        {reviewable && t.claimantId === user.id && (
                          <p className="subtext mt-2">
                            Another approved Treasurer must review your request.
                          </p>
                        )}
                        {reviewable && !t.claimantId && (
                          <p className="subtext mt-2">
                            Missing claimant; review blocked.
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap">{date(t.createdAt)}</td>
                      <td>
                        <span
                          className={`badge ${t.status === "posted" ? "active" : ["void", "rejected"].includes(t.status) ? "danger" : "pending"}`}
                        >
                          {t.status === "posted"
                            ? "Posted"
                            : t.status === "void"
                              ? "Voided"
                              : t.status === "rejected"
                                ? "Rejected"
                                : t.status === "test"
                                  ? "TEST — excluded"
                                  : "Pending review"}
                        </span>
                        {t.reviewedAt && (
                          <p className="subtext mt-2">
                            {reviewer?.name ?? "Recorded reviewer"} ·{" "}
                            {date(t.reviewedAt)}
                          </p>
                        )}
                        {t.decisionReason && (
                          <p className="subtext mt-2">{t.decisionReason}</p>
                        )}
                      </td>
                      <td
                        className={`text-right whitespace-nowrap font-semibold ${t.type === "INCOME" ? "text-[#397048]" : "text-[#9b5f46]"}`}
                      >
                        {t.type === "INCOME" ? "+" : "−"}
                        {money(t.amountCents, t.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!transactions.length && (
            <Empty>No entries match these filters.</Empty>
          )}
          <nav
            className="flex flex-wrap gap-3 items-center mt-4"
            aria-label="Ledger pages"
          >
            {activePage > 1 && (
              <Link
                className="button secondary small"
                href={pageHref(activePage - 1)}
              >
                Previous
              </Link>
            )}
            <span className="subtext">
              Page {activePage} of {pageCount} · {transactions.length} matching
              entries
            </span>
            {activePage < pageCount && (
              <Link
                className="button secondary small"
                href={pageHref(activePage + 1)}
              >
                Next
              </Link>
            )}
          </nav>
        </section>
        <section className="glass-panel panel h-fit">
          <h2 className="section-title">Submit an expense</h2>
          <p className="subtext mt-2 mb-5">
            Keep your receipt for review. You cannot approve your own request.
          </p>
          <ExpenseForm />
          <h2 className="section-title mt-6 mb-3">
            Record fundraiser receipts
          </h2>
          <ActionForm action={createFundraiserIncome}>
            <input type="hidden" name="requestKey" value={randomUUID()} />
            <label className="field">
              <span>Fundraiser / receipt description</span>
              <input
                className="input"
                name="description"
                minLength={3}
                maxLength={200}
                required
              />
            </label>
            <label className="field">
              <span>Currency</span>
              <select className="input" name="currency" required>
                <option value="USD">USD</option>
                <option value="INR">INR</option>
              </select>
            </label>
            <label className="field">
              <span>Amount already received</span>
              <input
                className="input"
                type="number"
                name="amount"
                min="0.01"
                max="100000"
                step="0.01"
                required
              />
            </label>
            <button className="button">Record income</button>
            <p className="subtext">
              Record actual receipts received separately. This form does not
              collect payment.
            </p>
          </ActionForm>
        </section>
      </div>
    </main>
  );
}
