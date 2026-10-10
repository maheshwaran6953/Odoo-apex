import { ActionForm } from "@/components/club/action-form";
import { addInventoryItem } from "@/server/actions/merchandise";
import { db } from "@/lib/db";
import { currentRole } from "@/server/auth";
import { PageHeading, Empty } from "@/components/club/ui";
import { ShopProduct } from "@/components/club/shop-product";
export default async function MerchandisePage() {
  const items = await db.inventoryItem.findMany({
    orderBy: [{ name: "asc" }, { size: "asc" }],
  });
  const role = await currentRole();
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
