import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import { hasClubAccess } from "@/lib/access";

export async function updateVolunteerTask(
  actorId: string,
  taskId: unknown,
  status: unknown,
  database: PrismaClient = db,
) {
  if (
    typeof taskId !== "string" ||
    !taskId ||
    taskId.length > 100 ||
    typeof status !== "string" ||
    !["TODO", "DOING", "DONE"].includes(status)
  )
    return { ok: false, message: "Choose a valid task and status." };
  return database.$transaction(async (tx) => {
    const actor = await tx.user.findUnique({ where: { id: actorId } });
    if (!hasClubAccess(actor))
      return {
        ok: false,
        message: "An approved, verified account is required.",
      };
    if (actor.role !== "STAFF" && !actor.memberId)
      return {
        ok: false,
        message: "Only Staff or the assigned volunteer can update this task.",
      };
    const changed = await tx.task.updateMany({
      where: {
        id: taskId,
        ...(actor.role === "STAFF" ? {} : { assigneeId: actor.memberId }),
      },
      data: { status: status as "TODO" | "DOING" | "DONE" },
    });
    return changed.count
      ? { ok: true, message: "Task status updated on the board." }
      : {
          ok: false,
          message: "Task unavailable or assigned to another volunteer.",
        };
  });
}

export async function adjustInventoryStock(
  actorId: string,
  itemId: string,
  delta: number,
  reason: string,
  requestKey: string,
  database: PrismaClient = db,
) {
  if (
    !itemId ||
    itemId.length > 100 ||
    !Number.isSafeInteger(delta) ||
    delta === 0 ||
    Math.abs(delta) > 1_000_000 ||
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 300 ||
    /[\u0000-\u001f\u007f]/.test(reason) ||
    !/^[a-f0-9-]{36}$/.test(requestKey)
  )
    throw Error(
      "Choose an item, a nonzero whole adjustment within +/-1,000,000 and a reason of 3-300 characters.",
    );
  const key = actorId + ":" + requestKey;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await database.$transaction(
        async (tx) => {
          const actor = await tx.user.findUnique({ where: { id: actorId } });
          if (!hasClubAccess(actor, ["STAFF"]))
            throw Error("Only approved, verified Staff can adjust stock.");
          const prior = await tx.inventoryMovement.findUnique({
            where: { requestKey: key },
          });
          if (prior) {
            if (
              prior.itemId !== itemId ||
              prior.delta !== delta ||
              prior.reason !== reason.trim()
            )
              throw Error(
                "This submission was already used for a different adjustment. Refresh.",
              );
            return {
              ok: true,
              message:
                "Adjustment already recorded; stock was not changed again.",
            };
          }
          const item = await tx.inventoryItem.findUnique({
            where: { id: itemId },
          });
          if (!item) throw Error("This stock item no longer exists.");
          const afterStock = item.stock + delta;
          if (
            !Number.isSafeInteger(afterStock) ||
            afterStock < 0 ||
            afterStock > 1_000_000
          )
            throw Error(
              "Resulting stock must be between 0 and 1,000,000. Refresh the current stock.",
            );
          const changed = await tx.inventoryItem.updateMany({
            where: { id: itemId, stock: item.stock },
            data: { stock: afterStock },
          });
          if (!changed.count)
            throw Error(
              "Stock changed while you were editing. Refresh and retry.",
            );
          await tx.inventoryMovement.create({
            data: {
              itemId,
              actorId,
              delta,
              beforeStock: item.stock,
              afterStock,
              reason: reason.trim(),
              requestKey: key,
            },
          });
          return {
            ok: true,
            message:
              "Stock adjusted from " +
              item.stock +
              " to " +
              afterStock +
              ". Audit record saved; no financial entry was created.",
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        !["P2034", "P2002"].includes(error.code) ||
        attempt === 3
      )
        throw error;
    }
  }
  throw Error("Stock is busy. Retry after refreshing.");
}
