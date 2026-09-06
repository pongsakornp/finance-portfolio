import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionUserId = vi.hoisted(() => vi.fn());
const getPortfolioHoldingsSnapshot = vi.hoisted(() => vi.fn());

vi.mock("@/lib/session", () => ({ getSessionUserId }));
vi.mock("@/lib/services/portfolio-export-service", () => ({ getPortfolioHoldingsSnapshot }));

import { GET } from "@/app/api/portfolios/[id]/export/route";

const portfolioId = "11111111-1111-4111-8111-111111111111";

describe("portfolio holdings export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionUserId.mockResolvedValue("user-1");
    getPortfolioHoldingsSnapshot.mockResolvedValue({
      portfolio: { id: portfolioId, name: "Long Term Portfolio" },
      exportedAt: "2026-09-06T12:00:00.000Z",
      baseCurrency: "USD",
      totals: {},
      holdings: [],
    });
  });

  it("requires an authenticated session", async () => {
    getSessionUserId.mockResolvedValue(null);

    const response = await GET(new Request("https://example.test/api/portfolios/x/export"), {
      params: Promise.resolve({ id: portfolioId }),
    });

    expect(response.status).toBe(401);
    expect(getPortfolioHoldingsSnapshot).not.toHaveBeenCalled();
  });

  it("returns a JSON attachment for an owned portfolio", async () => {
    const response = await GET(new Request("https://example.test/api/portfolios/x/export"), {
      params: Promise.resolve({ id: portfolioId }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="long-term-portfolio-holdings-2026-09-06.json"'
    );
    await expect(response.json()).resolves.toMatchObject({
      portfolio: { id: portfolioId },
      holdings: [],
    });
  });

  it("does not disclose foreign or invalid portfolio IDs", async () => {
    getPortfolioHoldingsSnapshot.mockRejectedValueOnce(new Error("Portfolio not found"));
    const foreign = await GET(new Request("https://example.test/api/portfolios/x/export"), {
      params: Promise.resolve({ id: portfolioId }),
    });
    const invalid = await GET(new Request("https://example.test/api/portfolios/x/export"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });

    expect(foreign.status).toBe(404);
    expect(invalid.status).toBe(404);
  });
});
