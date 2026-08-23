import { describe, expect, it } from "vitest";

import {
  computePosition,
  computeTotals,
} from "@/lib/services/holdings-service";

const tx = (
  type: "buy" | "sell" | "dividend",
  quantity: number,
  price = 0,
  fee = 0
) => ({ type, quantity, price, fee });

describe("computePosition — average cost method", () => {
  it("computes unrealized P/L on buys", () => {
    const pos = computePosition([tx("buy", 10, 100, 0)], 120);
    expect(pos.qty).toBe(10);
    expect(pos.costBasis).toBe(1000);
    expect(pos.marketValue).toBe(1200);
    expect(pos.unrealizedPL).toBe(200);
    expect(pos.unrealizedPLPct).toBe(20);
  });

  it("includes fees in cost basis", () => {
    const pos = computePosition([tx("buy", 1, 100, 5)], 100);
    expect(pos.avgCost).toBe(105);
    expect(pos.unrealizedPL).toBe(-5);
  });

  it("realizes P/L at average cost on partial sell", () => {
    // buy 10 @100, buy 10 @200 -> avg 150; sell 10 @180
    const pos = computePosition(
      [tx("buy", 10, 100), tx("buy", 10, 200), tx("sell", 10, 180)],
      190
    );
    expect(pos.realizedPL).toBe(300); // (180-150)*10
    expect(pos.qty).toBe(10);
    expect(pos.avgCost).toBe(150);
    expect(pos.unrealizedPL).toBe(400); // (190-150)*10
    expect(pos.costBasis).toBe(1500);
  });

  it("clears position on full close without dust cost", () => {
    const pos = computePosition([tx("buy", 3, 33.333333), tx("sell", 3, 40)], 40);
    expect(pos.qty).toBe(0);
    expect(pos.avgCost).toBe(0);
    expect(pos.costBasis).toBe(0);
    expect(pos.realizedPL).toBeCloseTo(20, 1);
  });

  it("ignores sells without holdings (oversell guard)", () => {
    const pos = computePosition([tx("sell", 5, 100)], 100);
    expect(pos.qty).toBe(0);
    expect(pos.realizedPL).toBe(0);
  });

  it("accumulates dividends from quantity field", () => {
    const pos = computePosition(
      [tx("buy", 10, 50), tx("dividend", 12.5), tx("dividend", 7)],
      50
    );
    expect(pos.dividendsReceived).toBe(19.5);
    expect(pos.realizedPL).toBe(0);
  });

  it("handles unknown price gracefully", () => {
    const pos = computePosition([tx("buy", 1, 100)], undefined);
    expect(pos.currentPrice).toBe(0);
    expect(pos.unrealizedPL).toBe(0);
    expect(pos.costBasis).toBe(100);
  });
});

describe("computeTotals", () => {
  it("sums positions and computes day change from previous closes", () => {
    const a = computePosition([tx("buy", 2, 100)], 110);
    const b = computePosition([tx("buy", 1, 200)], 210);
    const totals = computeTotals([
      { position: a, previousClose: 105 },
      { position: b, previousClose: null },
    ]);
    expect(totals.marketValue).toBe(430);
    expect(totals.costBasis).toBe(400);
    expect(totals.unrealizedPL).toBe(30);
    expect(totals.dayChange).toBeCloseTo(10, 5); // (110-105)*2 for asset A only
  });
});
