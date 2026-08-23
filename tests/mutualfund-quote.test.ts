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
