"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole, requireUser } from "@/server/auth";
import { updateVolunteerTask } from "@/server/operations-service";
import { validName } from "@/lib/validation";
export async function moveTask(input: unknown) {
  const user = await requireUser();
  const data =
    input instanceof FormData
      ? { taskId: input.get("taskId"), status: input.get("status") }
      : input;
  if (
    !data ||
    typeof data !== "object" ||
    !("taskId" in data) ||
    !("status" in data)
  )
    return { ok: false, message: "Choose a valid task and status." };
  try {
    const result = await updateVolunteerTask(user.id, data.taskId, data.status);
    if (result.ok) {
      revalidatePath("/fundraisers");
      revalidatePath("/");
    }
    return result;
  } catch {
    return { ok: false, message: "Unable to update this task. Try again." };
  }
}
export async function addTask(data: FormData) {
  await requireRole(["STAFF"]);
  const title = String(data.get("title") ?? "").trim();
  const description = String(data.get("description") ?? "").trim();
  const assigneeId = String(data.get("assigneeId") ?? "").trim() || undefined;
  const rawDate = String(data.get("dueAt") ?? "").trim();
  const dueAt = rawDate ? new Date(rawDate) : undefined;
  if (
    !validName(title, 3, 200) ||
    description.length > 3000 ||
    (dueAt && (!Number.isFinite(dueAt.getTime()) || dueAt <= new Date()))
  )
    return {
      ok: false,
      message:
        "Enter a title of 3–200 characters, description up to 3000 characters, and a future due date.",
    };
  try {
    if (
      assigneeId &&
      !(await db.member.findUnique({ where: { id: assigneeId } }))
    )
      return { ok: false, message: "Choose an existing volunteer." };
    await db.task.create({
      data: { title, description: description || undefined, assigneeId, dueAt },
    });
    revalidatePath("/fundraisers");
    revalidatePath("/");
    return { ok: true, message: "Task added to the To do column." };
  } catch {
    return {
      ok: false,
      message: "Unable to add this task. Check the volunteer and try again.",
    };
  }
}
