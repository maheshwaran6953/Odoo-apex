import { timingSafeEqual } from "node:crypto";
import { processEventUpdates } from "@/server/events-service";
import { deliverQueuedEmail } from "@/server/email";
import { processPaymentUpdates } from "@/server/payments-service";
import { processMembershipUpdates } from "@/server/club-service";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response("Unauthorized", { status: 401 });
  if (process.env.PAYMENT_JOBS_ENABLED === "true")
    await processPaymentUpdates();
  await processEventUpdates();
  await processMembershipUpdates();
  const email = await deliverQueuedEmail({ limit: 10 });
  return Response.json({ processed: true, email });
}
export async function POST(request: Request) {
  return GET(request);
}
