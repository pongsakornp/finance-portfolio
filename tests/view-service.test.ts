import { beforeEach, describe, expect, it, vi } from "vitest";

const getQuote = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    assetId: "a1",
    symbol: "AAPL",
    name: "Apple",
    type: "stock" as const,
    currency: "USD",
    price: 100,
    previousClose: 101,
  })
);
const getRate = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ toNumber: () => 1 })
);

vi.mock("@/lib/services/quote-service", () => ({ getQuote }));
vi.mock("@/lib/services/fx-service", () => ({ getRate }));

import { buildHoldingsView } from "@/lib/services/view-service";

function tx(id: string, symbol: string, assetType: string, currency: string) {
  return {
    id,
    portfolioId: "p1",
    assetId: id,
    type: "buy" as const,
    quantity: "1",
    price: "10",
    fee: "0",
    occurredAt: new Date("2026-01-01"),
    note: null,
    createdAt: new Date("2026-01-01"),
    asset: { id, symbol, name: symbol, nameEn: null, nameTh: null, type: assetType as never, currency, market: (symbol.endsWith(".BK") ? "SET" : "US") as "US" | "SET", externalId: null, createdAt: new Date("2026-01-01") },
  };
}

describe("buildHoldingsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQuote.mockResolvedValue({
      assetId: "a1",
      symbol: "AAPL",
      name: "Apple",
      type: "stock" as const,
      currency: "USD",
      price: 100,
      previousClose: 101,
    });
    getRate.mockResolvedValue({ toNumber: () => 1 });
  });

  it("does not throw when a crypto quote rejects, and skips that holding", async () => {
    getQuote
      .mockResolvedValueOnce({
        assetId: "usd",
        symbol: "AAPL",
        name: "Apple",
        type: "stock" as const,
        currency: "USD",
        price: 100,
        previousClose: 101,
      })
      .mockRejectedValueOnce(new Error("No quote available for ADA"));

    const view = await buildHoldingsView([
      tx("usd", "AAPL", "stock", "USD"),
      tx("ada", "ADA", "crypto", "USD"),
    ]);

    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].asset.symbol).toBe("AAPL");
  });

  it("converts non-USD cost basis and realized PL into USD totals", async () => {
    getQuote
      .mockResolvedValueOnce({
        assetId: "thb-1",
        symbol: "PTT.BK",
        name: "PTT",
        type: "stock" as const,
        currency: "THB",
        price: 35,
        previousClose: 34,
      })
      .mockResolvedValueOnce({
        assetId: "usd-1",
        symbol: "AAPL",
        name: "Apple",
        type: "stock" as const,
        currency: "USD",
        price: 150,
        previousClose: 148,
      });

    // 1 THB = 0.03 USD
    getRate.mockResolvedValue({ toNumber: () => 0.03 });

    const view = await buildHoldingsView([
      tx("thb-1", "PTT.BK", "stock", "THB"), // qty 1 @ 10 THB = 0.30 USD
      tx("usd-1", "AAPL", "stock", "USD"), // qty 1 @ 10 USD = 10 USD
    ]);

    expect(view.rows).toHaveLength(2);
    // Cost basis should be 0.30 USD + 10 USD = 10.30 USD (not 10 THB + 10 USD = 20)
    expect(view.totalsUsd.costBasis).toBe(10.3);
    // Day change must be in USD too: THB (35-34)*1*0.03 = 0.03 + USD (150-148)*1 = 2.00
    expect(view.totalsUsd.dayChange).toBeCloseTo(2.03, 2);
  });
});
