import { timingSafeEqual } from "node:crypto";
import { processEventUpdates } from "@/server/events-service";
import { deliverQueuedEmail } from "@/server/email";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    supplied.length !== expected.length ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  )
    return new Response("Unauthorized", { status: 401 });
  await processEventUpdates();
  const email = await deliverQueuedEmail();
  return Response.json({ processed: true, email });
}
export async function POST(request: Request) {
  return GET(request);
}
