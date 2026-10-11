import Link from "next/link";
import {
  financeCategories,
  financeStatuses,
  type FinanceFilters,
} from "@/server/finance-report-service";

export function FinanceFilterForm({
  filters,
  error,
}: {
  filters: FinanceFilters;
  error?: string;
}) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => !!v),
  ).toString();
  return (
    <section className="glass-panel panel mb-5">
      <div className="panel-heading">
        <h2>Filter ledger</h2>
        {!error && (
          <a
            className="button secondary small"
            href={"/api/finance/export?" + query}
          >
            Export filtered CSV
          </a>
        )}
      </div>
      <form
        method="get"
        action="/treasurer"
        className="grid gap-3 md:grid-cols-3 xl:grid-cols-4"
      >
        <label className="field">
          <span>From date (UTC)</span>
          <input
            className="input"
            name="from"
            type="date"
            defaultValue={filters.from}
          />
        </label>
        <label className="field">
          <span>To date (UTC, inclusive)</span>
          <input
            className="input"
            name="to"
            type="date"
            defaultValue={filters.to}
          />
        </label>
        <label className="field">
          <span>Currency</span>
          <select
            className="input"
            name="currency"
            defaultValue={filters.currency}
          >
            <option value="">All currencies (separate totals)</option>
            <option>USD</option>
            <option>INR</option>
          </select>
        </label>
        <label className="field">
          <span>Category</span>
          <select
            className="input"
            name="category"
            defaultValue={filters.category}
          >
            <option value="">All categories</option>
            {financeCategories.map((v) => (
              <option key={v} value={v}>
                {v.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Status</span>
          <select className="input" name="status" defaultValue={filters.status}>
            <option value="">All statuses</option>
            {financeStatuses.map((v) => (
              <option key={v} value={v}>
                {v === "test" ? "Test — excluded from balance" : v}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Entry type</span>
          <select className="input" name="type" defaultValue={filters.type}>
            <option value="">Income and expenses</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expenses</option>
          </select>
        </label>
        <label className="field">
          <span>Description contains</span>
          <input
            className="input"
            name="q"
            maxLength={100}
            defaultValue={filters.q}
          />
        </label>
        <div className="flex gap-2 items-end pb-1">
          <button className="button">Apply filters</button>
          <Link href="/treasurer" className="button secondary">
            Clear
          </Link>
        </div>
      </form>
      {error ? (
        <p role="alert" className="form-feedback failure mt-3">
          {error}
        </p>
      ) : (
        <p className="subtext mt-3">
          Summary and CSV include all matching entries, up to 10,000; the table
          shows 25 per page. Dates in reports use UTC.
        </p>
      )}
    </section>
  );
}
