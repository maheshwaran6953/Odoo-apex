import { currentUser } from "@/server/auth";
import { exportFinance } from "@/server/finance-report-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input: Record<string, string | string[]> = {};
  params.forEach((_, key) => {
    const values = params.getAll(key);
    input[key] = values.length === 1 ? values[0] : values;
  });
  return exportFinance(await currentUser(), input);
}
