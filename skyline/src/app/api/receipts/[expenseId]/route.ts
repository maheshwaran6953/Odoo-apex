import { currentUser } from "@/server/auth";
import { downloadExpenseReceipt } from "@/server/expense-service";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params: paramsPromise }: { params: Promise<{ expenseId: string }> },
) {
  const params = await paramsPromise;
  const actor = await currentUser();
  if (!actor) return new Response("Sign in required.", { status: 401 });
  return downloadExpenseReceipt(actor.id, params.expenseId);
}
