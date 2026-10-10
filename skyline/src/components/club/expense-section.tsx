import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { createExpense } from "@/server/actions/treasurer";
import { ActionForm } from "@/components/club/action-form";
import { date, money, Empty } from "@/components/club/ui";

export function ExpenseForm() {
  return (
    <ActionForm action={createExpense}>
      <label className="field">
        <span>What was it for?</span>
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
        <select className="input" name="currency" required defaultValue="USD">
          <option value="USD">USD — US dollar</option>
          <option value="INR">INR — Indian rupee</option>
        </select>
      </label>
      <label className="field">
        <span>Amount</span>
        <input
          className="input"
          name="amount"
          type="number"
          min="0.01"
          max="100000"
          step="0.01"
          required
        />
      </label>
      <button className="button">Submit for review</button>
      <p className="subtext mt-3">
        Pending and rejected requests do not affect the ledger. Approval records
        an expense, not a bank transfer.
      </p>
    </ActionForm>
  );
}

export async function ExpenseAccountSection({ userId }: { userId: string }) {
  const user = await requireUser();
  if (user.id !== userId)
    throw new Error("You can only view your own expense requests.");
  const requests = await db.transaction.findMany({
    where: { claimantId: user.id, type: "EXPENSE", category: "REIMBURSEMENT" },
    orderBy: { createdAt: "desc" },
  });
  return (
    <section className="glass-panel panel mt-5">
      <h2 className="section-title">Submit a club expense</h2>
      <p className="subtext mt-2 mb-5">
        Keep your receipt. A Treasurer reviews your request before it affects
        the ledger.
      </p>
      <div className="max-w-[640px]">
        <ExpenseForm />
      </div>
      <h3 className="section-title mt-6 mb-3">My expense requests</h3>
      {!requests.length ? (
        <Empty>You have not submitted any expenses.</Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Expense</th>
                <th>Submitted</th>
                <th>Amount</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id}>
                  <td>{request.description}</td>
                  <td>{date(request.createdAt)}</td>
                  <td>{money(request.amountCents, request.currency)}</td>
                  <td>
                    <span
                      className={`badge ${request.status === "posted" ? "active" : request.status === "rejected" ? "danger" : "pending"}`}
                    >
                      {request.status === "posted"
                        ? "Approved"
                        : request.status === "rejected"
                          ? "Rejected"
                          : "Pending review"}
                    </span>
                    {request.reviewedAt && (
                      <p className="subtext mt-1">
                        Reviewed {date(request.reviewedAt)}
                      </p>
                    )}
                    {request.decisionReason && (
                      <p className="subtext mt-1">{request.decisionReason}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
