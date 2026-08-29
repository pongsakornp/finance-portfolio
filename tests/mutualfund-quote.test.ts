import { afterEach, describe, expect, it, vi } from "vitest";
// minimal db stub: getQuote only reads the price_cache row and upserts on miss
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({ limit: () => Promise.resolve([]) }),
      }),
    }),
    insert: () => ({
      values: () => ({
        onConflictDoUpdate: () => Promise.resolve(),
        onConflictDoNothing: () => Promise.resolve(),
      }),
    }),
  },
}));

import { getQuote } from "@/lib/services/quote-service";

const fundAsset = {
  id: "mf-1",
  symbol: "B-EQUITY",
  name: "กองทุนเปิดบัวหลวงหุ้นทุน",
  type: "mutualfund",
  currency: "THB",
  externalId: null,
  createdAt: new Date(),
} as never;

const setAsset = {
  id: "set-1",
  symbol: "PTT.BK",
  name: "PTT PCL",
  type: "stock",
  currency: "THB",
  market: "SET",
  externalId: null,
  createdAt: new Date(),
} as never;

const cleanup = () => vi.unstubAllGlobals();

describe("mutual fund quotes (Finnomena NAV)", () => {
  afterEach(cleanup);

  it("maps latest NAV close to price and prior close to previousClose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ s: "ok", t: [1754006400, 1754092800], c: [27.6409, 27.9104] }),
      }))
    );
    const q = await getQuote(fundAsset);
    expect(q.price).toBe(27.9104);
    expect(q.previousClose).toBe(27.6409);
    expect(q.currency).toBe("THB");
  });

  it("fails loudly when the API reports no data (stale fallback handles it upstream)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ s: "no_data" }),
      }))
    );
    await expect(getQuote(fundAsset)).rejects.toThrow(/No quote available|no NAV/);
  });
});

describe("SET market quotes (Finnomena-first, Yahoo fallback)", () => {
  afterEach(cleanup);

  it("uses Finnomena NAV when the bare SET code resolves (ETFs/funds)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ s: "ok", t: [1754006400, 1754092800], c: [10.6871, 10.6684] }),
      }))
    );
    const q = await getQuote(setAsset);
    expect(q.price).toBe(10.6684);
    expect(q.previousClose).toBe(10.6871);
    expect(q.currency).toBe("THB");
    // must have hit Finnomena with '.BK' stripped, not Yahoo
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("finnomena.com");
    expect(url).toContain("symbol=PTT");
  });

  it("falls back to Yahoo (appends .BK) when Finnomena rejects the code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ s: "no_data" }) })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            chart: { result: [{ meta: { regularMarketPrice: 40.5, previousClose: 41, currency: "THB" } }] },
          }),
        })
    );
    const q = await getQuote(setAsset);
    expect(q.price).toBe(40.5);
    expect(q.previousClose).toBe(41);
    expect(q.currency).toBe("THB");
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => u as string);
    expect(urls[0]).toContain("finnomena.com");
    expect(urls[0]).toContain("symbol=PTT");
    expect(urls[1]).toContain("yahoo.com");
    expect(urls[1]).toContain("PTT.BK");
  });
});
