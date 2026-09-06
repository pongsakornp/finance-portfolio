import { afterEach, describe, expect, it, vi } from "vitest";

import { searchStocks } from "@/lib/services/stock-search-service";

afterEach(() => vi.unstubAllGlobals());

describe("searchStocks", () => {
  const quotes = [
    { exchange: "NMS", quoteType: "EQUITY", symbol: "AAPL", longname: "Apple Inc." },
    { exchange: "PCX", quoteType: "ETF", symbol: "VOO", longname: "Vanguard S&P 500 ETF" },
    { exchange: "SET", quoteType: "EQUITY", symbol: "PTT.BK", longname: "PTT Public Company Limited" },
    { exchange: "SET", quoteType: "ETF", symbol: "TDEX.BK", shortname: "ThaiDEX SET50 ETF" },
    { exchange: "CCC", quoteType: "CRYPTOCURRENCY", symbol: "BTC-USD", longname: "Bitcoin USD" },
  ];

  it("returns US stocks and ETFs only", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ quotes }) })));

    await expect(searchStocks("app", "US")).resolves.toEqual([
      { symbol: "AAPL", nameEn: "Apple Inc.", assetType: "stock" },
      { symbol: "VOO", nameEn: "Vanguard S&P 500 ETF", assetType: "etf" },
    ]);
  });

  it("returns SET stocks and ETFs with Yahoo's suffix removed", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ quotes }) }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchStocks("ptt", "SET")).resolves.toEqual([
      { symbol: "PTT", nameEn: "PTT Public Company Limited", assetType: "stock" },
      { symbol: "TDEX", nameEn: "ThaiDEX SET50 ETF", assetType: "etf" },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("q=ptt.BK"),
      expect.anything()
    );
  });

  it("excludes OTC and Pink listings from US results", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        quotes: [
          { exchange: "OQB", quoteType: "ETF", symbol: "OTCF", longname: "OTC ETF" },
          { exchange: "PNK", quoteType: "EQUITY", symbol: "PINK", longname: "Pink Stock" },
        ],
      }),
    })));

    await expect(searchStocks("otc", "US")).resolves.toEqual([]);
  });

  it("does not append Yahoo's SET suffix twice", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ quotes }) }));
    vi.stubGlobal("fetch", fetchMock);

    await searchStocks("PTT.BK", "SET");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("q=PTT.BK"),
      expect.anything()
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("PTT.BK.BK"),
      expect.anything()
    );
  });
});
