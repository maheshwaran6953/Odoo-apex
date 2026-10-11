import { ActionForm } from "@/components/club/action-form";
import {
  addInventoryItem,
  fulfillMerchandiseOrder,
} from "@/server/actions/merchandise";
import { db } from "@/lib/db";
import { requireUser } from "@/server/auth";
import { PageHeading, Empty, money, date } from "@/components/club/ui";
import { ShopProduct } from "@/components/club/shop-product";
import { activeMembership } from "@/server/club-service";
export default async function MerchandisePage() {
  const user = await requireUser();
  const role = user.role;
  const items = await db.inventoryItem.findMany({
    orderBy: [{ name: "asc" }, { size: "asc" }],
  });
  const orders = await db.merchandiseOrder.findMany({
    where: role === "STAFF" ? {} : { userId: user.id },
    include: { lines: { include: { item: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const buyers =
    role === "STAFF"
      ? await db.user.findMany({
          where: {
            id: {
              in: orders.flatMap((order) =>
                order.userId ? [order.userId] : [],
              ),
            },
          },
          select: { id: true, name: true, email: true },
        })
      : [];
  const buyerNames = new Map(
    buyers.map((buyer) => [buyer.id, `${buyer.name} (${buyer.email})`]),
  );
  const groups = Array.from(new Set(items.map((i) => i.name))).map((name) =>
    items.filter((i) => i.name === name),
  );
  return (
    <main>
      <PageHeading
        eyebrow="MADE FOR CAMPUS DAYS"
        title="Wear a little Skyline."
        description="Club essentials, available sizes, and stock you can actually count on."
      />
      {role === "STAFF" && (
        <details className="disclosure mb-5">
          <summary>Add inventory item</summary>
          <ActionForm action={addInventoryItem}>
            <label className="field">
              <span>Product name</span>
              <input
                className="input"
                name="name"
                required
                minLength={2}
                maxLength={100}
              />
            </label>
            <label className="field">
              <span>Category</span>
              <input
                className="input"
                name="category"
                required
                maxLength={60}
              />
            </label>
            <label className="field">
              <span>Size (optional)</span>
              <input className="input" name="size" maxLength={20} />
            </label>
            <label className="field">
              <span>Stock</span>
              <input
                className="input"
                name="stock"
                type="number"
                min="0"
                max="1000000"
                step="1"
                required
              />
            </label>
            <label className="field">
              <span>Price (USD)</span>
              <input
                className="input"
                name="price"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                required
              />
            </label>
            <label className="field">
              <span>Active member price (optional USD)</span>
              <input
                className="input"
                name="memberPrice"
                type="number"
                min="0"
                max="100000"
                step="0.01"
              />
              <small className="subtext">
                Leave empty for no discount. Must not exceed the regular price.
              </small>
            </label>
            <button className="button">Add stock item</button>
          </ActionForm>
        </details>
      )}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <ShopProduct
            key={group[0].name}
            items={group}
            canOrder={role !== "TREASURER"}
            eligibleForDiscount={activeMembership(user.member?.membership)}
          />
        ))}
      </div>
      {!items.length && (
        <div className="glass-panel">
          <Empty>
            The shop is taking a breather. Products will appear when stock is
            added.
          </Empty>
        </div>
      )}
      <section className="glass-panel panel mt-5">
        <h2 className="section-title mb-3">
          {role === "STAFF" ? "Club orders and collection" : "My club orders"}
        </h2>
        <p className="subtext mb-3">
          Latest 100 orders. All orders are practice records; no online payment
          collected.
        </p>
        {!orders.length ? (
          <Empty>No club orders yet.</Empty>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Order / buyer</th>
                  <th>Items and sizes</th>
                  <th>Ordered</th>
                  <th>Total (USD)</th>
                  <th>Collection</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.id.slice(-8)}</strong>
                      {role === "STAFF" && (
                        <p className="subtext">
                          {order.userId
                            ? buyerNames.get(order.userId) ||
                              "Account unavailable"
                            : "Legacy order"}
                        </p>
                      )}
                    </td>
                    <td>
                      {order.lines.map((line) => (
                        <p key={line.id}>
                          {line.quantity} × {line.item.name} ·{" "}
                          {line.item.size || "One size"} ·{" "}
                          {money(line.unitPriceCents)} each
                        </p>
                      ))}
                    </td>
                    <td>{date(order.createdAt)}</td>
                    <td>{money(order.totalCents)}</td>
                    <td>
                      <span
                        className={`badge ${order.status === "FULFILLED" ? "active" : "pending"}`}
                      >
                        {order.status === "FULFILLED"
                          ? "Collected"
                          : order.status === "PAID"
                            ? "Awaiting collection"
                            : order.status}
                      </span>
                      {order.fulfilledAt && (
                        <p className="subtext">{date(order.fulfilledAt)}</p>
                      )}
                      {role === "STAFF" && order.status === "PAID" && (
                        <ActionForm
                          action={fulfillMerchandiseOrder.bind(null, order.id)}
                        >
                          <button className="button secondary small mt-2">
                            Mark collected
                          </button>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="glass-panel panel mt-5">
        <h2 className="section-title">Good to know</h2>
        <p className="subtext mt-2">
          Orders immediately reserve the selected size and update the club
          ledger. Ask the committee about collection arrangements; shipping and
          card payments aren’t connected in this practice app.
        </p>
      </section>
    </main>
  );
}
