import { afterEach, describe, expect, it, vi } from "vitest";

import { searchCommodities } from "@/lib/services/commodity-search-service";

afterEach(() => vi.unstubAllGlobals());

describe("searchCommodities", () => {
  it("returns Yahoo futures and excludes non-commodity search results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        quotes: [
          { symbol: "GC=F", quoteType: "FUTURE", shortname: "Gold Futures" },
          { symbol: "GLD", quoteType: "ETF", shortname: "SPDR Gold Shares" },
          { symbol: "GC=F", quoteType: "FUTURE", shortname: "Duplicate" },
        ],
      }),
    })));

    await expect(searchCommodities("gold")).resolves.toEqual([
      { symbol: "GC=F", name: "Gold Futures" },
    ]);
  });

  it("does not call Yahoo for an empty query", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchCommodities("  ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
