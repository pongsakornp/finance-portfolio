import { z } from "zod";

import { getSessionUserId } from "@/lib/session";
import { assertOwnedPortfolio } from "@/lib/services/portfolio-service";
import { getUserBaseCurrency } from "@/lib/services/user-settings-service";
import { getUserTransactions } from "@/lib/services/view-service";
import { convertUsdSeries, unrealizedPlSeries } from "@/lib/services/valuation-service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "not found" }, { status: 404 });

  const days = Math.min(
    Math.max(parseInt(new URL(request.url).searchParams.get("days") ?? "90", 10) || 90, 7),
    1825
  );

  try {
    await assertOwnedPortfolio(id, userId);
    const [transactions, baseCurrency] = await Promise.all([
      getUserTransactions(userId, id),
      getUserBaseCurrency(userId),
    ]);
    const points = await convertUsdSeries(await unrealizedPlSeries(transactions, days), baseCurrency);
    return Response.json({ points, currency: baseCurrency });
  } catch (error) {
    if (error instanceof Error && error.message === "Portfolio not found") {
      return Response.json({ error: "not found" }, { status: 404 });
    }
    return Response.json({ points: [], currency: "USD" }, { status: 200 });
  }
}
