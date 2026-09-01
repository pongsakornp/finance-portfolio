import { beforeEach, describe, expect, it, vi } from "vitest";

const assertOwnedPortfolio = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const getQuote = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    assetId: "a1",
    symbol: "AAPL",
    name: "Apple",
    type: "stock",
    currency: "USD",
    price: 150,
    previousClose: 148,
  })
);

const getUserPortfolios = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const getUserTransactions = vi.hoisted(() => vi.fn().mockResolvedValue([]));
const buildHoldingsView = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    rows: [],
    totalsUsd: {
      marketValue: 0,
      costBasis: 0,
      unrealizedPL: 0,
      unrealizedPLPct: 0,
      realizedPL: 0,
      dayChange: 0,
      dayChangePct: 0,
    },
  })
);

vi.mock("@/lib/services/portfolio-service", () => ({ assertOwnedPortfolio }));
vi.mock("@/lib/services/quote-service", () => ({ getQuote }));
vi.mock("@/lib/services/view-service", () => ({
  getUserPortfolios,
  getUserTransactions,
  buildHoldingsView,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/db", () => {
  const insertValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "new-id" }]) });
  const selectWhere = vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
  const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
  const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });

  return {
    db: {
      insert: vi.fn().mockReturnValue({ values: insertValues }),
      select: vi.fn().mockReturnValue({ from: selectFrom }),
      update: vi.fn().mockReturnValue({ set: updateSet }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    },
  };
});

import { db } from "@/lib/db";
import { buildMcpServer } from "@/lib/mcp/tools";
import { importTransactions } from "@/lib/services/transaction-service";

describe("importTransactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes note and asset fields into database insert", async () => {
    const insertMock = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.insert).mockReturnValue({ values: insertMock } as never);

    // Mock asset find to return an existing asset ID
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: "asset-1", currency: "THB" }]),
        }),
      }),
    } as never);

    const validUuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const result = await importTransactions(
      [
        {
          symbol: "B-EQUITY",
          name: "B-EQUITY",
          assetType: "mutualfund",
          type: "buy",
          quantity: 5000,
          price: 30,
          fee: 0,
          occurredAt: "2026-01-01T00:00:00.000Z",
          note: "Initial investment",
        },
      ],
      validUuid,
      "user-1"
    );

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: validUuid,
        note: "Initial investment",
        quantity: "5000",
        price: "30",
      })
    );
  });
});

describe("MCP tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("list_portfolios counts only active holdings (qty > 0)", async () => {
    getUserPortfolios.mockResolvedValueOnce([
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Main", userId: "user-1", createdAt: new Date() },
    ]);
    getUserTransactions.mockResolvedValueOnce([]);
    buildHoldingsView.mockResolvedValueOnce({
      rows: [
        {
          asset: { symbol: "AAPL", name: "Apple", type: "stock", currency: "USD" },
          position: { qty: 10, avgCost: 150, costBasis: 1500, marketValue: 1600, unrealizedPL: 100, unrealizedPLPct: 6.67, realizedPL: 0, currentPrice: 160 },
          price: 160,
          previousClose: 158,
          valueUsd: 1600,
          costUsd: 1500,
        },
        {
          asset: { symbol: "TSLA", name: "Tesla", type: "stock", currency: "USD" },
          position: { qty: 0, avgCost: 0, costBasis: 0, marketValue: 0, unrealizedPL: 0, unrealizedPLPct: 0, realizedPL: 50, currentPrice: 200 },
          price: 200,
          previousClose: 195,
          valueUsd: 0,
          costUsd: 0,
        },
      ],
      totalsUsd: {
        marketValue: 1600,
        costBasis: 1500,
        unrealizedPL: 100,
        unrealizedPLPct: 6.67,
        realizedPL: 50,
        dayChange: 20,
        dayChangePct: 1.25,
      },
    });

    const server = buildMcpServer("user-1");
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ text: string }> }> }> })._registeredTools;
    const res = await registeredTools["list_portfolios"].handler({});
    const data = JSON.parse(res.content[0].text);

    expect(data).toHaveLength(1);
    expect(data[0].holdingsCount).toBe(1); // TSLA with qty 0 is excluded
  });

  it("what_if_sell skips closed positions and finds active holding", async () => {
    getUserPortfolios.mockResolvedValueOnce([
      { id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11", name: "Old Portfolio", userId: "user-1", createdAt: new Date() },
      { id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22", name: "Active Portfolio", userId: "user-1", createdAt: new Date() },
    ]);
    getUserTransactions.mockResolvedValue([]);
    buildHoldingsView
      .mockResolvedValueOnce({
        rows: [
          {
            asset: { symbol: "BTC", name: "Bitcoin", type: "crypto", currency: "USD" },
            position: { qty: 0, avgCost: 0, costBasis: 0, marketValue: 0, unrealizedPL: 0, unrealizedPLPct: 0, realizedPL: 200, currentPrice: 60000 },
            price: 60000,
            previousClose: 59000,
            valueUsd: 0,
            costUsd: 0,
          },
        ],
        totalsUsd: {} as never,
      })
      .mockResolvedValueOnce({
        rows: [
          {
            asset: { symbol: "BTC", name: "Bitcoin", type: "crypto", currency: "USD" },
            position: { qty: 2, avgCost: 50000, costBasis: 100000, marketValue: 120000, unrealizedPL: 20000, unrealizedPLPct: 20, realizedPL: 0, currentPrice: 60000 },
            price: 60000,
            previousClose: 59000,
            valueUsd: 120000,
            costUsd: 100000,
          },
        ],
        totalsUsd: {} as never,
      });

    const server = buildMcpServer("user-1");
    const registeredTools = (server as unknown as { _registeredTools: Record<string, { handler: (args: unknown) => Promise<{ content: Array<{ text: string }> }> }> })._registeredTools;
    const res = await registeredTools["what_if_sell"].handler({ symbol: "BTC", quantity: 1 });
    const data = JSON.parse(res.content[0].text);

    expect(data.portfolio).toBe("Active Portfolio");
    expect(data.sellQty).toBe(1);
    expect(data.estimatedProceeds).toBe(60000);
    expect(data.estimatedRealizedPL).toBe(10000);
  });
});
