import { createHash } from "node:crypto";
import { verifyWebhookSignature } from "@/server/razorpay";
import { processProviderWebhook } from "@/server/payments-service";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 65536) return new Response("Body too large", { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Missing body", { status: 400 });
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 65536) { await reader.cancel(); return new Response("Body too large", { status: 413 }); } chunks.push(value); }
  const body = Buffer.concat(chunks).toString("utf8");
  try { if (!verifyWebhookSignature(body, request.headers.get("x-razorpay-signature") || "")) return new Response("Invalid signature", { status: 401 }); }
  catch { return new Response("Webhook configuration unavailable", { status: 503 }); }
  const id = request.headers.get("x-razorpay-event-id");
  if (!id || id.length > 200) return new Response("Missing event ID", { status: 400 });
  let payload;
  try { payload = JSON.parse(body); if (!payload || typeof payload !== "object" || typeof payload.event !== "string") throw new Error(); }
  catch { return new Response("Invalid body", { status: 400 }); }
  try { await processProviderWebhook(id, createHash("sha256").update(body).digest("hex"), payload); return Response.json({ received: true }); }
  catch { return new Response("Webhook processing incomplete; retry required", { status: 503 }); }
}
