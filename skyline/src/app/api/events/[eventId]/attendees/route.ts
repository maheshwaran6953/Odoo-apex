import { currentUser } from "@/server/auth";
import { exportAttendees } from "@/server/attendee-export-service";
export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ eventId: string }> },
) {
  const params = await paramsPromise;
  return exportAttendees(await currentUser(), params.eventId);
}
