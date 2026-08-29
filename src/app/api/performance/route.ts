import { benchmarkSeries, portfolioSeries } from "@/lib/services/valuation-service";
import { getUserTransactions } from "@/lib/services/view-service";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function normalize(points: Array<{ day: string; value: number }>) {
  if (points.length === 0) return [];
  const firstPositiveIdx = points.findIndex((p) => p.value > 0);
  if (firstPositiveIdx === -1) {
    return points.map((p) => ({ day: p.day, pct: 0 }));
  }
  const base = points[firstPositiveIdx].value;
  return points.map((p, idx) => ({
    day: p.day,
    pct: idx < firstPositiveIdx ? 0 : Math.round(((p.value - base) / base) * 10000) / 100,
  }));
}

export async function GET(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const days = Math.min(
    Math.max(parseInt(new URL(request.url).searchParams.get("days") ?? "90", 10) || 90, 7),
    3650
  );

  try {
    const txs = await getUserTransactions(userId);
    const [portfolioRaw, benchmarkRaw] = await Promise.all([
      portfolioSeries(txs, days),
      benchmarkSeries(days),
    ]);

    // align benchmark to the portfolio's window
    const start = portfolioRaw[0]?.day;
    const aligned = start ? benchmarkRaw.filter((b) => b.day >= start) : [];

    return Response.json({
      portfolio: normalize(portfolioRaw),
      benchmark: normalize(aligned),
    });
  } catch {
    return Response.json({ portfolio: [], benchmark: [] });
  }
}
