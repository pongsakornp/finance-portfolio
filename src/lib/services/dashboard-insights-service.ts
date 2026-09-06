import Decimal from "decimal.js";

export type DashboardInsightHolding = {
  symbol: string;
  name: string;
  valueUsd: number;
  previousClose: number | null;
  dayChangePct: number;
};

export type DashboardInsights = {
  largest: DashboardInsightHolding & { weightPct: number };
  topFiveWeightPct: number;
  bestMover: DashboardInsightHolding | null;
  worstMover: DashboardInsightHolding | null;
};

/** Produces compact concentration and daily-mover insights from priced open holdings. */
export function buildDashboardInsights(
  holdings: DashboardInsightHolding[]
): DashboardInsights | null {
  if (holdings.length === 0) return null;

  const byValue = [...holdings].sort((a, b) => {
    const comparison = new Decimal(b.valueUsd).cmp(a.valueUsd);
    return comparison || a.symbol.localeCompare(b.symbol);
  });
  const total = byValue.reduce((sum, holding) => sum.plus(holding.valueUsd), new Decimal(0));
  if (total.lte(0)) return null;

  const largest = byValue[0];
  const topFive = byValue
    .slice(0, 5)
    .reduce((sum, holding) => sum.plus(holding.valueUsd), new Decimal(0));
  const pct = (value: Decimal) => value.div(total).mul(100).toDecimalPlaces(2).toNumber();

  const movers = holdings
    .filter((holding) => holding.previousClose !== null)
    .sort((a, b) => b.dayChangePct - a.dayChangePct || a.symbol.localeCompare(b.symbol));

  return {
    largest: { ...largest, weightPct: pct(new Decimal(largest.valueUsd)) },
    topFiveWeightPct: pct(topFive),
    bestMover: movers[0] ?? null,
    // Do not repeat a single priced holding as both best and worst mover.
    worstMover: movers.length > 1 ? movers[movers.length - 1] : null,
  };
}
