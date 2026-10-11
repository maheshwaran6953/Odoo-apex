"use client";
import { useState } from "react";
import { createMerchandiseOrder } from "@/server/actions/merchandise";
import { ActionForm } from "./action-form";
import { money } from "./ui";
type Item = {
  id: string;
  name: string;
  category: string;
  size: string | null;
  priceCents: number;
  memberPriceCents: number | null;
  stock: number;
};
export function ShopProduct({
  items,
  canOrder,
  eligibleForDiscount,
}: {
  items: Item[];
  canOrder: boolean;
  eligibleForDiscount: boolean;
}) {
  const [selected, setSelected] = useState(
    items.find((i) => i.stock > 0)?.id ?? items[0].id,
  );
  const [quantity, setQuantity] = useState(1);
  const item = items.find((i) => i.id === selected) ?? items[0];
  const priceCents =
    eligibleForDiscount && item.memberPriceCents !== null
      ? item.memberPriceCents
      : item.priceCents;
  const hoodie = item.category.toLowerCase().includes("hood");
  return (
    <article className="glass-panel panel">
      <div
        className="product-art"
        style={{ background: hoodie ? "#dce3d5" : "#e9e1d3" }}
      >
        <span className="badge">Skyline essentials</span>
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label={
            hoodie
              ? "Illustration of a forest green Skyline hoodie"
              : "Illustration of a cream Skyline T-shirt"
          }
        >
          <path
            d={
              hoodie
                ? "M70 45 Q70 12 100 12 Q130 12 130 45 L163 65 L188 120 L161 133 L145 104 L145 184 L55 184 L55 104 L39 133 L12 120 L37 65 Z"
                : "M70 40 Q100 58 130 40 L173 61 L191 103 L162 116 L143 87 L143 180 L57 180 L57 87 L38 116 L9 103 L27 61 Z"
            }
            fill={hoodie ? "#385347" : "#f4f0e5"}
            stroke={hoodie ? "#284336" : "#bcb29e"}
            strokeWidth="2"
          />
          {hoodie && (
            <>
              <path
                d="M70 45 Q100 64 130 45 Q118 25 100 25 Q82 25 70 45"
                fill="#253e32"
              />
              <path
                d="M79 62 L77 89 M121 62 L123 89"
                stroke="#e3e7d6"
                strokeWidth="2"
              />
              <path d="M77 147 L123 147 L133 169 L67 169 Z" fill="#304a3e" />
            </>
          )}
          <text
            x="100"
            y="110"
            textAnchor="middle"
            fill={hoodie ? "#e6e8d5" : "#3a5141"}
            fontFamily="Georgia,serif"
            fontSize="19"
          >
            skyline
          </text>
          <text
            x="100"
            y="124"
            textAnchor="middle"
            fill={hoodie ? "#bacab4" : "#71836c"}
            fontSize="5"
            letterSpacing="1.5"
          >
            STUDENT ASSOCIATION
          </text>
        </svg>
      </div>
      <div className="flex justify-between items-start gap-4 mt-5">
        <div>
          <h2 className="section-title">{item.name}</h2>
          <p className="subtext mt-1">{item.category}</p>
        </div>
        <strong className="text-lg whitespace-nowrap">
          {money(priceCents)}
        </strong>
      </div>
      {item.memberPriceCents !== null && (
        <p className="subtext mt-2">
          Active member price {money(item.memberPriceCents)} · regular{" "}
          {money(item.priceCents)}.{" "}
          {eligibleForDiscount
            ? "Your membership discount applies."
            : "An active, unexpired membership is required."}
        </p>
      )}
      <ActionForm action={createMerchandiseOrder} className="mt-5">
        <input type="hidden" name="itemId" value={item.id} />
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <label className="field">
            <span>Size</span>
            <select
              className="input"
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setQuantity(1);
              }}
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.size ?? "One size"} ·{" "}
                  {i.stock > 0 ? `${i.stock} available` : "Sold out"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Quantity</span>
            <input
              className="input"
              name="quantity"
              type="number"
              min="1"
              max={Math.max(Math.min(item.stock, 10), 1)}
              required
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="flex justify-between items-center mb-4">
          <span
            className={`badge ${item.stock === 0 ? "danger" : item.stock <= 3 ? "pending" : "active"}`}
          >
            {item.stock === 0
              ? "Sold out"
              : item.stock <= 3
                ? `Only ${item.stock} left`
                : "In stock"}
          </span>
          <span className="subtext">
            Total <strong>{money(priceCents * quantity)}</strong>
          </span>
        </div>
        <button
          disabled={!canOrder || item.stock === 0}
          className="button w-full"
        >
          {!canOrder
            ? "Switch to Member or Staff to order"
            : item.stock === 0
              ? "Currently unavailable"
              : "Place club order"}
        </button>
      </ActionForm>
      <p className="subtext mt-3">
        Practice order · No online payment is collected.
      </p>
    </article>
  );
}
