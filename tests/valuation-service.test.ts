import { describe, expect, it } from "vitest";
import type { Asset } from "@/lib/services/quote-service";
import {
  isHistoryFresh,
  walkSeries,
  type SeriesContext,
} from "@/lib/services/valuation-service";

function makeAsset(overrides: Partial<Asset> = {}): Asset {
  return {
    id: "asset-1",
    symbol: "AAA",
    name: "Asset A",
    nameEn: null,
    nameTh: null,
    type: "stock",
    currency: "USD",
    market: "US",
    externalId: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("isHistoryFresh", () => {
  const cutoff = "2026-09-03";

  it("uses a recent official close without another full history backfill", () => {
    expect(isHistoryFresh("2026-09-04", cutoff)).toBe(true);
    expect(isHistoryFresh(cutoff, cutoff)).toBe(true);
  });

  it("backfills only missing or genuinely stale history", () => {
    expect(isHistoryFresh("2026-09-02", cutoff)).toBe(false);
    expect(isHistoryFresh(undefined, cutoff)).toBe(false);
  });
});

describe("walkSeries", () => {
  const asset = makeAsset();
  const day = (d: string) => new Date(`${d}T00:00:00Z`);
  const baseCtx: SeriesContext = {
    distinctAssets: [asset],
    txsAsc: [
      { type: "buy", quantity: "10", price: "10", fee: "0", occurredAt: day("2026-01-01"), asset },
      { type: "buy", quantity: "10", price: "20", fee: "0", occurredAt: day("2026-01-02"), asset },
      { type: "sell", quantity: "15", price: "30", fee: "0", occurredAt: day("2026-01-03"), asset },
    ],
    windowStart: "2026-01-01",
    closeMaps: new Map([
      [
        "asset-1",
        new Map([
          ["2026-01-01", 10],
          ["2026-01-02", 11],
          ["2026-01-03", 12],
          ["2026-01-04", 13],
        ]),
      ],
    ]),
    fxByDay: new Map(),
    usdRates: new Map(),
    timeline: ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"],
  };

  it("applies average-cost basis across buys and a partial sell", () => {
    const states = [...walkSeries(baseCtx)];
    const pos = states[states.length - 1].positions.get("asset-1");
    expect(pos?.qty.toNumber()).toBe(5);
    expect(pos?.cost.toNumber()).toBe(75);
  });

  it("clamps oversells and zeroes cost on a full close", () => {
    const ctx: SeriesContext = {
      ...baseCtx,
      txsAsc: [
        { type: "buy", quantity: "10", price: "10", fee: "0", occurredAt: day("2026-01-01"), asset },
        { type: "sell", quantity: "99", price: "30", fee: "0", occurredAt: day("2026-01-02"), asset },
      ],
    };
    const states = [...walkSeries(ctx)];
    const pos = states[states.length - 1].positions.get("asset-1");
    expect(pos?.qty.toNumber()).toBe(0);
    expect(pos?.cost.toNumber()).toBe(0);
  });
});
