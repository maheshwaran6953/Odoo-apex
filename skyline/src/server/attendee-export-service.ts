import { db } from "@/lib/db";
import { hasClubAccess, type AccountAccess } from "@/lib/access";
import { csvResponse } from "@/lib/csv";
export async function exportAttendees(
  actor: AccountAccess | null,
  eventId: string,
) {
  if (!hasClubAccess(actor, ["STAFF"]))
    return new Response("Approved, verified Staff access required.", {
      status: 403,
    });
  if (!eventId || eventId.length > 100)
    return new Response("Event not found.", { status: 404 });
  const event = await db.event.findUnique({
    where: { id: eventId },
    include: { tickets: { orderBy: { createdAt: "asc" } } },
  });
  if (!event) return new Response("Event not found.", { status: 404 });
  return csvResponse(
    [
      [
        "Name",
        "Email",
        "Phone",
        "Code",
        "Category",
        "Recorded price",
        "Currency",
        "Payment mode",
        "Status",
        "Registered at (UTC)",
        "Checked in at (UTC)",
      ],
      ...event.tickets.map((t) => [
        t.attendeeName,
        t.attendeeEmail,
        t.attendeePhone || "",
        t.code,
        t.type,
        (t.priceCents / 100).toFixed(2),
        t.currency,
        t.paymentMode === "RAZORPAY_TEST"
          ? "Razorpay Test Mode"
          : "Practice (simulated)",
        t.status === "PAID"
          ? "Registered"
          : t.status === "CHECKED_IN"
            ? "Checked in"
            : t.status,
        t.createdAt.toISOString(),
        t.checkedInAt?.toISOString() || "",
      ]),
    ],
    "skyline-attendees.csv",
  );
}
