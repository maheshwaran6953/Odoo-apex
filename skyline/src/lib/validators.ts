import { z } from 'zod';

export const memberIdSchema = z.string().min(1);
export const merchandiseOrderSchema = z.object({
  memberId: z.string().optional(),
  itemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(10),
});
