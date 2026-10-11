import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { ActionForm } from "@/components/club/action-form";
import { adjustStock } from "@/server/actions/merchandise";
import { date, Empty } from "@/components/club/ui";
import type { InventoryItem } from "@prisma/client";

export async function StockAdjustments({ items }: { items: InventoryItem[] }) {
  const changes = await db.inventoryMovement.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { item: true },
  });
  const people = await db.user.findMany({
    where: { id: { in: Array.from(new Set(changes.map((c) => c.actorId))) } },
    select: { id: true, name: true },
  });
  const names = new Map(people.map((p) => [p.id, p.name]));
  return (
    <details className="disclosure mb-5">
      <summary>Receive or adjust merchandise stock</summary>
      {!items.length ? (
        <Empty>Add an inventory item before adjusting stock.</Empty>
      ) : (
        <ActionForm action={adjustStock}>
          <input type="hidden" name="requestKey" value={randomUUID()} />
          <div className="grid gap-4 md:grid-cols-3">
            <label className="field">
              <span>Product and size</span>
              <select className="input" name="itemId" required>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} · {i.size || "One size"} · {i.stock} available
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Quantity change (+ receive / − remove)</span>
              <input
                className="input"
                type="number"
                name="delta"
                step="1"
                min="-1000000"
                max="1000000"
                required
              />
            </label>
            <label className="field">
              <span>Reason</span>
              <input
                className="input"
                name="reason"
                minLength={3}
                maxLength={300}
                required
              />
            </label>
          </div>
          <button className="button">Record stock adjustment</button>
          <p className="subtext">
            Stock cannot become negative. Adjustments are audited and do not
            create income, expenses or customer returns.
          </p>
        </ActionForm>
      )}
      <h3 className="section-title mt-5 mb-3">Recent adjustments</h3>
      {!changes.length ? (
        <Empty>No stock adjustments recorded.</Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Product / size</th>
                <th>Change</th>
                <th>Before → after</th>
                <th>Reason / recorded by</th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id}>
                  <td>{date(c.createdAt)}</td>
                  <td>
                    {c.item.name} · {c.item.size || "One size"}
                  </td>
                  <td>
                    {c.delta > 0 ? "+" : ""}
                    {c.delta}
                  </td>
                  <td>
                    {c.beforeStock} → {c.afterStock}
                  </td>
                  <td>
                    {c.reason}
                    <p className="subtext">
                      {names.get(c.actorId) || "Recorded Staff"}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}
