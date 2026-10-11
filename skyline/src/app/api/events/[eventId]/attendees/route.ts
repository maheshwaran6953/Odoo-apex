import { currentUser } from "@/server/auth";
import { exportAttendees } from "@/server/attendee-export-service";
export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } },
) {
  return exportAttendees(await currentUser(), params.eventId);
}
