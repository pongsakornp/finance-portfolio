import { describe, expect, it } from "vitest";

import { resolveCoinId } from "@/lib/services/coin-map";

describe("resolveCoinId", () => {
  it("returns a mapped CoinGecko id for a known ticker", () => {
    expect(resolveCoinId("BTC")).toBe("bitcoin");
    expect(resolveCoinId("ada")).toBe("cardano");
    expect(resolveCoinId("hbAr")).toBe("hedera-hashgraph");
  });

  it("prefers an explicit stored externalId over the ticker map", () => {
    expect(resolveCoinId("BTC", "custom-id")).toBe("custom-id");
  });

  it("returns null for unknown tickers and no externalId", () => {
    expect(resolveCoinId("ZZZZ")).toBeNull();
    expect(resolveCoinId("")).toBeNull();
  });
});
