import { afterEach, describe, expect, it, vi } from "vitest";
// minimal db stub: getQuote only reads the price_cache row and upserts on miss
const { updateSet, dbUpdate } = vi.hoisted(() => {
  const updateSet = vi.fn(() => ({ where: () => Promise.resolve() }));
  const dbUpdate = vi.fn(() => ({ set: updateSet }));
  return { updateSet, dbUpdate };
});

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
    update: dbUpdate,
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

describe("SET market quotes (Finnomena share feed, Yahoo .BK fallback)", () => {
  afterEach(cleanup);

  it("quotes a SET stock from Finnomena's share feed and derives previousClose", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          statusCode: 200,
          data: { name: "PTT", price: "40.5", th_name: "PTT PCL", currency: "THB", perf_1d: "0.5", perf_p_1d: "1.25" },
        }),
      }))
    );
    const q = await getQuote(setAsset);
    expect(q.price).toBe(40.5);
    expect(q.previousClose).toBe(40); // 40.5 - perf_1d(0.5)
    expect(q.currency).toBe("THB");
    const urls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map(([u]) => u as string);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("market-info/api/public/stock/quote/PTT");
    expect(urls[0]).toContain("finnomena.com");
    expect(urls[0]).not.toContain("yahoo.com");
  });

  it("uses a bare SET symbol (ask → stock/quote/ASK)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          statusCode: 200,
          data: { name: "ASK", price: "10.9", th_name: "Asia Sermkij Leasing", currency: "THB", perf_1d: "-0.3" },
        }),
      }))
    );
    const q = await getQuote({
      id: "set-1",
      symbol: "ASK",
      name: "ASK",
      type: "stock",
      currency: "THB",
      market: "SET",
      externalId: null,
      createdAt: new Date(),
    } as never);
    expect(q.price).toBe(10.9);
    expect(q.previousClose).toBeCloseTo(11.2); // 10.9 - (-0.3)
    expect(q.name).toBe("Asia Sermkij Leasing");
    const url = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(url).toContain("stock/quote/ASK");
    expect(url).not.toContain("ASK.BK");
  });

  it("updates asset name in db when stock name was stuck at symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          status: true,
          statusCode: 200,
          data: { name: "PR9", price: "19.6", th_name: "Praram 9 Hospital Public Company Limited", currency: "THB", perf_1d: "0.3" },
        }),
      }))
    );
    const q = await getQuote({
      id: "pr9-1",
      symbol: "PR9",
      name: "PR9",
      type: "stock",
      currency: "THB",
      market: "SET",
      externalId: null,
      createdAt: new Date(),
    } as never);
    expect(q.name).toBe("Praram 9 Hospital Public Company Limited");
    expect(dbUpdate).toHaveBeenCalled();
    expect(updateSet).toHaveBeenCalledWith({ name: "Praram 9 Hospital Public Company Limited" });
  });

  it("falls back to Yahoo .BK when Finnomena has no quote", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 422, json: async () => ({ statusCode: 422, stack: [] }) })
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
    expect(urls[0]).toContain("stock/quote/PTT");
    expect(urls[1]).toContain("yahoo.com");
    expect(urls[1]).toContain("PTT.BK");
  });
});
