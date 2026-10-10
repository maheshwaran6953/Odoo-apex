import type { Prisma } from "@prisma/client";
import { newToken } from "@/lib/password";
export async function linkVerifiedMembership(
  tx: Prisma.TransactionClient,
  userId: string,
  email: string,
) {
  const member = await tx.member.findUnique({ where: { email } });
  await tx.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date(), memberId: member?.id },
  });
  if (!member) return;
  const legacy = await tx.ticket.findMany({
    where: { memberId: member.id, userId: null },
    orderBy: { createdAt: "asc" },
  });
  for (const ticket of legacy) {
    if (
      await tx.ticket.findUnique({
        where: { eventId_userId: { eventId: ticket.eventId, userId } },
      })
    )
      continue;
    await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        userId,
        attendeeName: member.name,
        attendeeEmail: email,
        qrToken: ticket.status === "PAID" ? newToken() : null,
        code: `SKY-${newToken().slice(0, 20).toUpperCase()}`,
      },
    });
  }
}
