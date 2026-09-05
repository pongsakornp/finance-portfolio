import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchCoinMarketCapHistory,
  fetchCoinMarketCapQuote,
} from "@/lib/services/coinmarketcap-service";

const cleanup = () => {
  delete process.env.COINMARKETCAP_API_KEY;
  vi.unstubAllGlobals();
};

describe("CoinMarketCap crypto market data", () => {
  afterEach(cleanup);

  it("fetches a USD quote using the configured server-side API key", async () => {
    process.env.COINMARKETCAP_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ id: 1, quote: [{ symbol: "USD", price: 100, percent_change_24h: 25 }] }],
      }),
    })));

    await expect(fetchCoinMarketCapQuote("1")).resolves.toEqual({
      price: 100,
      previousClose: 80,
      currency: "USD",
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v3/cryptocurrency/quotes/latest?id=1&convert=USD"),
      expect.objectContaining({ headers: expect.objectContaining({ "X-CMC_PRO_API_KEY": "test-key" }) })
    );
  });

  it("rejects a missing API key before making a provider request", async () => {
    await expect(fetchCoinMarketCapQuote("1")).rejects.toThrow("COINMARKETCAP_API_KEY");
  });

  it("maps valid historical USD points and skips incomplete points", async () => {
    process.env.COINMARKETCAP_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: {
          1: {
            quotes: [
              { timestamp: "2026-01-01T23:59:00.000Z", quote: { USD: { price: 100 } } },
              { timestamp: "2026-01-02T23:59:00.000Z", quote: { USD: { price: 0 } } },
            ],
          },
        },
      }),
    })));

    await expect(fetchCoinMarketCapHistory("1", 5)).resolves.toEqual([
      { timestamp: "2026-01-01T23:59:00.000Z", price: 100 },
    ]);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v3/cryptocurrency/quotes/historical?id=1&convert=USD&interval=24h"),
      expect.any(Object)
    );
  });
});
