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
    asset: { id, symbol, name: symbol, type: assetType as never, currency, externalId: null, createdAt: new Date("2026-01-01") },
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

  it("still builds all holdings when every quote succeeds", async () => {
    const view = await buildHoldingsView([
      tx("a1", "AAPL", "stock", "USD"),
      tx("a2", "MSFT", "stock", "USD"),
    ]);
    expect(view.rows).toHaveLength(2);
  });
});
