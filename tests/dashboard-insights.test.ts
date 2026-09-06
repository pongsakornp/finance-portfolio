import { describe, expect, it } from "vitest";

import { buildDashboardInsights } from "@/lib/services/dashboard-insights-service";

const holding = (
  symbol: string,
  valueUsd: number,
  dayChangePct: number,
  previousClose: number | null = 100
) => ({ symbol, name: symbol, valueUsd, dayChangePct, previousClose });

describe("buildDashboardInsights", () => {
  it("calculates largest-position and top-five concentration", () => {
    const insights = buildDashboardInsights([
      holding("A", 50, 1), holding("B", 20, -2), holding("C", 10, 3),
      holding("D", 8, 0), holding("E", 7, 2), holding("F", 5, -1),
    ]);

    expect(insights?.largest.symbol).toBe("A");
    expect(insights?.largest.weightPct).toBe(50);
    expect(insights?.topFiveWeightPct).toBe(95);
  });

  it("uses all holdings when fewer than five are held", () => {
    const insights = buildDashboardInsights([holding("A", 60, 1), holding("B", 40, -1)]);
    expect(insights?.topFiveWeightPct).toBe(100);
  });

  it("ranks daily percentage movers and excludes unavailable price data", () => {
    const insights = buildDashboardInsights([
      holding("UP", 20, 5),
      holding("DOWN", 20, -4),
      holding("UNKNOWN", 100, 99, null),
    ]);
    expect(insights?.bestMover?.symbol).toBe("UP");
    expect(insights?.worstMover?.symbol).toBe("DOWN");
  });

  it("does not duplicate a single eligible mover", () => {
    const insights = buildDashboardInsights([holding("ONLY", 100, 2)]);
    expect(insights?.bestMover?.symbol).toBe("ONLY");
    expect(insights?.worstMover).toBeNull();
  });
});
