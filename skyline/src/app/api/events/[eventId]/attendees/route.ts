import { db } from "@/lib/db";
import { currentUser } from "@/server/auth";
export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } },
) {
  const user = await currentUser();
  if (!user || user.role !== "STAFF")
    return new Response("Staff access required.", { status: 403 });
  const tickets = await db.ticket.findMany({
    where: { eventId: params.eventId },
    orderBy: { createdAt: "asc" },
  });
  const cell = (value: string) =>
    `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
  const lines = [
    [
      "Name",
      "Email",
      "Phone",
      "Code",
      "Category",
      "Recorded price (USD)",
      "Status",
      "Registered at",
      "Checked in at",
    ],
    ...tickets.map((t) => [
      t.attendeeName,
      t.attendeeEmail,
      t.attendeePhone || "",
      t.code,
      t.type,
      (t.priceCents / 100).toFixed(2),
      t.status === "PAID" ? "Registered (simulated payment)" : t.status,
      t.createdAt.toISOString(),
      t.checkedInAt?.toISOString() || "",
    ]),
  ];
  return new Response(
    "\uFEFF" + lines.map((row) => row.map(cell).join(",")).join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="skyline-attendees.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
}
