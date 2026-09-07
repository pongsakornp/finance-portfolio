import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserId = vi.hoisted(() => vi.fn());
const assertOwnedPortfolio = vi.hoisted(() => vi.fn());
const getUserBaseCurrency = vi.hoisted(() => vi.fn());
const getUserTransactions = vi.hoisted(() => vi.fn());
const unrealizedPlSeries = vi.hoisted(() => vi.fn());
const convertUsdSeries = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ getSessionUserId }));
vi.mock("@/lib/services/portfolio-service", () => ({ assertOwnedPortfolio }));
vi.mock("@/lib/services/user-settings-service", () => ({ getUserBaseCurrency }));
vi.mock("@/lib/services/view-service", () => ({ getUserTransactions }));
vi.mock("@/lib/services/valuation-service", () => ({ unrealizedPlSeries, convertUsdSeries }));

import { GET } from "@/app/api/portfolios/[id]/unrealized-pl/route";

const portfolioId = "11111111-1111-4111-8111-111111111111";

describe("portfolio unrealized P/L route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserId.mockResolvedValue("user-1");
    getUserBaseCurrency.mockResolvedValue("THB");
    getUserTransactions.mockResolvedValue([]);
    unrealizedPlSeries.mockResolvedValue([{ day: "2026-09-01", value: 100 }]);
    convertUsdSeries.mockResolvedValue([{ day: "2026-09-01", value: 3500 }]);
  });

  it("requires an authenticated session", async () => {
    getSessionUserId.mockResolvedValue(null);

    const response = await GET(new Request("https://example.test/api/portfolios/x/unrealized-pl"), {
      params: Promise.resolve({ id: portfolioId }),
    });

    expect(response.status).toBe(401);
    expect(assertOwnedPortfolio).not.toHaveBeenCalled();
  });

  it("returns the owned portfolio series in the user's base currency", async () => {
    const response = await GET(new Request("https://example.test/api/portfolios/x/unrealized-pl?days=90"), {
      params: Promise.resolve({ id: portfolioId }),
    });

    expect(response.status).toBe(200);
    expect(assertOwnedPortfolio).toHaveBeenCalledWith(portfolioId, "user-1");
    expect(getUserTransactions).toHaveBeenCalledWith("user-1", portfolioId);
    expect(unrealizedPlSeries).toHaveBeenCalledWith([], 90);
    await expect(response.json()).resolves.toEqual({
      points: [{ day: "2026-09-01", value: 3500 }],
      currency: "THB",
    });
  });

  it("hides invalid and foreign portfolios", async () => {
    assertOwnedPortfolio.mockRejectedValueOnce(new Error("Portfolio not found"));
    const foreign = await GET(new Request("https://example.test/api/portfolios/x/unrealized-pl"), {
      params: Promise.resolve({ id: portfolioId }),
    });
    const invalid = await GET(new Request("https://example.test/api/portfolios/x/unrealized-pl"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(foreign.status).toBe(404);
    expect(invalid.status).toBe(404);
  });

  it("clamps the requested history range to five years", async () => {
    await GET(new Request("https://example.test/api/portfolios/x/unrealized-pl?days=9999"), {
      params: Promise.resolve({ id: portfolioId }),
    });

    expect(unrealizedPlSeries).toHaveBeenCalledWith([], 1825);
  });
});
