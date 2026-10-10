import { db } from "@/lib/db";
export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } },
) {
  const event = await db.event.findUnique({ where: { id: params.eventId } });
  if (!event) return new Response("Event not found", { status: 404 });
  const escape = (text: string) =>
    text
      .replaceAll("\\", "\\\\")
      .replaceAll("\n", "\\n")
      .replaceAll(";", "\\;")
      .replaceAll(",", "\\,")
      .replaceAll("\r", "");
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Skyline//Student Events//EN",
    "BEGIN:VEVENT",
    `UID:${event.id}@skyline`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(event.startsAt)}`,
    `SUMMARY:${escape(event.name)}`,
    `LOCATION:${escape(event.location)}`,
    `DESCRIPTION:${escape(event.description)}`,
    `STATUS:${event.cancelledAt ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  // Fold UTF-8 lines at 75 octets, preserving multi-byte characters.
  const folded = lines.map((line) => {
    let out = "",
      chunk = "";
    for (const char of line) {
      if (Buffer.byteLength(chunk + char) > 74) {
        out += chunk + "\r\n ";
        chunk = "";
      }
      chunk += char;
    }
    return out + chunk;
  });
  return new Response(folded.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="skyline-event.ics"',
    },
  });
}
