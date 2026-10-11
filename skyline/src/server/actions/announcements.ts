"use server";
import { revalidatePath } from "next/cache";
import { requireRole, requireUser } from "@/server/auth";
import { publishClubAnnouncement } from "@/server/club-service";
export async function publishAnnouncement(input: unknown) {
  await requireRole(["STAFF", "TREASURER"]);
  const user = await requireUser();
  const data =
    input instanceof FormData
      ? {
          title: input.get("title"),
          body: input.get("body"),
          requestKey: input.get("requestKey"),
        }
      : input && typeof input === "object"
        ? (input as { title?: unknown; body?: unknown; requestKey?: unknown })
        : {};
  if (
    typeof data.title !== "string" ||
    typeof data.body !== "string" ||
    typeof data.requestKey !== "string"
  )
    return {
      ok: false,
      message: "Enter a title and message, or refresh this form.",
    };
  try {
    const result = await publishClubAnnouncement(
      user.id,
      data.title,
      data.body,
      data.requestKey,
    );
    for (const path of ["/announcements", "/notifications", "/"])
      revalidatePath(path);
    return result;
  } catch {
    return {
      ok: false,
      message:
        "Could not publish. Use a title of 3–120 characters and a message of 10–4,000 characters, then try again.",
    };
  }
}
