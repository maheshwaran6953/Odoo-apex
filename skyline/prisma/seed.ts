// @ts-nocheck
import { PrismaClient, MembershipStatus, TransactionCategory, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.announcement.deleteMany();
  await prisma.task.deleteMany();
  await prisma.merchandiseOrderLine.deleteMany();
  await prisma.merchandiseOrder.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.event.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.member.deleteMany();
  const aisha = await prisma.member.create({ data: { name: 'Aisha Rahman', email: 'aisha@skyline.club', membership: { create: { status: MembershipStatus.ACTIVE, duesCents: 1200, expiresAt: new Date('2026-12-31') } } } });
  const spring = await prisma.event.create({ data: { name: 'Spring Gala', description: 'An evening for the whole association.', startsAt: new Date('2026-04-24T19:00:00Z'), location: 'Skyline Hall', capacity: 180, memberPriceCents: 1200, nonMemberPriceCents: 1800 } });
  await prisma.ticket.create({ data: { code: 'SKY-2026-A1', eventId: spring.id, memberId: aisha.id, type: 'MEMBER', priceCents: 1200 } });
  await prisma.transaction.createMany({ data: [{ type: TransactionType.INCOME, category: TransactionCategory.DUES, description: 'Spring membership dues', amountCents: 1200, memberId: aisha.id }, { type: TransactionType.INCOME, category: TransactionCategory.TICKET, description: 'Spring Gala ticket', amountCents: 1200, memberId: aisha.id }] });
  await prisma.inventoryItem.createMany({ data: [{ name: 'Skyline Hoodie', category: 'Hoodie', size: 'M', priceCents: 3200, stock: 8 }, { name: 'Skyline Hoodie', category: 'Hoodie', size: 'L', priceCents: 3200, stock: 3 }, { name: 'Club T-shirt', category: 'T-shirt', size: 'M', priceCents: 1600, stock: 14 }] });
  await prisma.task.createMany({ data: [{ title: 'Buy baking supplies', status: 'TODO', dueAt: new Date('2026-04-18T10:00:00Z'), assigneeId: aisha.id }, { title: 'Run bake-sale table', status: 'DOING', dueAt: new Date('2026-04-19T09:00:00Z'), assigneeId: aisha.id }, { title: 'Design fundraiser poster', status: 'DONE', assigneeId: aisha.id }] });
  await prisma.announcement.create({ data: { title: 'Spring Gala tickets are live', body: 'Member pricing is now active. Bring your ticket code to the door and we will see you there.', audience: 'All members' } });
}

main().finally(() => prisma.$disconnect());
// @ts-nocheck
// @ts-nocheck
