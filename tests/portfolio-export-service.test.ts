import { beforeEach, describe, expect, it, vi } from "vitest";
import Decimal from "decimal.js";

const getQuote = vi.hoisted(() => vi.fn());
const getRate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/quote-service", () => ({ getQuote }));
vi.mock("@/lib/services/fx-service", () => ({ getRate }));

import { buildPortfolioHoldingsSnapshot } from "@/lib/services/portfolio-export-service";

function tx(id: string, symbol: string, currency = "USD", type: "buy" | "sell" = "buy") {
  return {
    id,
    portfolioId: "11111111-1111-4111-8111-111111111111",
    assetId: id,
    type,
    quantity: "2",
    price: "10",
    fee: "0",
    occurredAt: new Date("2026-01-02T00:00:00.000Z"),
    note: null,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    asset: {
      id,
      symbol,
      name: symbol,
      nameEn: null,
      nameTh: null,
      type: "stock" as const,
      currency,
      market: "US" as const,
      externalId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  };
}

describe("buildPortfolioHoldingsSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRate.mockResolvedValue({});
    getQuote.mockResolvedValue({ price: 15, previousClose: 14 });
  });

  it("exports current holdings and base-currency totals", async () => {
    const snapshot = await buildPortfolioHoldingsSnapshot(
      [tx("aapl", "AAPL")],
      { id: "p1", name: "Long term" },
      "USD",
      new Date("2026-09-06T12:00:00.000Z")
    );

    expect(snapshot).toMatchObject({
      portfolio: { id: "p1", name: "Long term" },
      exportedAt: "2026-09-06T12:00:00.000Z",
      baseCurrency: "USD",
      totals: {
        marketValue: 30,
        costBasis: 20,
        unrealizedPL: 10,
        dayChange: 2,
        valuedHoldingCount: 1,
        unpricedHoldingCount: 0,
      },
    });
    expect(snapshot.holdings[0]).toMatchObject({
      symbol: "AAPL",
      quantity: 2,
      currentPrice: 15,
      valuationStatus: "priced",
      marketValue: 30,
      unrealizedPLPct: 50,
    });
  });

  it("keeps an unpriced position with null valuation fields", async () => {
    getQuote.mockRejectedValueOnce(new Error("No quote"));

    const snapshot = await buildPortfolioHoldingsSnapshot(
      [tx("ada", "ADA")],
      { id: "p1", name: "Long term" },
      "USD"
    );

    expect(snapshot.totals).toMatchObject({
      marketValue: 0,
      valuedHoldingCount: 0,
      unpricedHoldingCount: 1,
    });
    expect(snapshot.holdings[0]).toMatchObject({
      symbol: "ADA",
      valuationStatus: "unavailable",
      currentPrice: null,
      marketValue: null,
      unrealizedPL: null,
    });
  });

  it("converts native-currency values into the selected base currency", async () => {
    getRate.mockResolvedValueOnce(new Decimal(0.03)); // THB → USD

    const snapshot = await buildPortfolioHoldingsSnapshot(
      [tx("ptt", "PTT", "THB")],
      { id: "p1", name: "Long term" },
      "USD"
    );

    expect(snapshot.totals).toMatchObject({
      marketValue: 0.9,
      costBasis: 0.6,
      unrealizedPL: 0.3,
      dayChange: 0.06,
    });
  });
});
