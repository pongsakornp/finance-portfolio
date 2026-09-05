import { beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ fetchCoinMarketCapCatalog: vi.fn() }));
const dbMocks = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn().mockResolvedValue(undefined);
  const remove = vi.fn(() => ({ where }));
  return { insert, values, onConflictDoUpdate, remove, where };
});

vi.mock("@/lib/services/coinmarketcap-service", () => provider);
vi.mock("@/lib/db", () => ({ db: { insert: dbMocks.insert, delete: dbMocks.remove } }));

import { refreshCryptoCatalog } from "@/lib/services/crypto-catalog-service";

describe("refreshCryptoCatalog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("upserts CoinMarketCap catalog entries and removes assets no longer active", async () => {
    provider.fetchCoinMarketCapCatalog.mockResolvedValue([
      { cmcId: "1", symbol: "BTC", name: "Bitcoin" },
      { cmcId: "1027", symbol: "ETH", name: "Ethereum" },
    ]);

    await refreshCryptoCatalog();

    expect(dbMocks.values).toHaveBeenCalledWith([
      { cmcId: "1", symbol: "BTC", name: "Bitcoin" },
      { cmcId: "1027", symbol: "ETH", name: "Ethereum" },
    ]);
    expect(dbMocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
    expect(dbMocks.remove).toHaveBeenCalledTimes(1);
    expect(dbMocks.where).toHaveBeenCalledTimes(1);
  });
});
