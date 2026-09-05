import { describe, expect, it, vi } from "vitest";

const assertOwnedPortfolio = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);

vi.mock("@/lib/services/portfolio-service", () => ({ assertOwnedPortfolio }));

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn(), delete: vi.fn() } }));

import { db } from "@/lib/db";
import { updateTransaction, upsertAsset } from "@/lib/services/transaction-service";

const data = {
  portfolioId: "port-1",
  symbol: "AAPL",
  assetType: "stock",
  type: "buy",
  quantity: "1",
  price: "100",
  fee: "0",
  occurredAt: new Date("2026-01-01"),
} as never;

function selectResolves(rows: unknown[]) {
  vi.mocked(db.select).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  } as never);
}

describe("upsertAsset", () => {
  it("reuses a legacy SET asset stored with Yahoo's .BK suffix", async () => {
    selectResolves([{ id: "asset-ptt" }]);

    await expect(
      upsertAsset({ symbol: "PTT", name: "PTT Public Company Limited", type: "stock", market: "SET" })
    ).resolves.toBe("asset-ptt");
  });

  it("returns the existing asset and does not re-denominate it (shared across users)", async () => {
    selectResolves([{ id: "asset-1", currency: "THB" }]);
    vi.mocked(db.update).mockClear();
    vi.mocked(db.delete).mockClear();

    await expect(
      upsertAsset({
        symbol: "B-EQUITY",
        name: "B-EQUITY",
        type: "mutualfund",
        currency: "USD", // a different currency must NOT overwrite the shared asset
      })
    ).resolves.toBe("asset-1");

    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("does not overwrite a shared asset's CoinMarketCap ID or touch the cache", async () => {
    selectResolves([{ id: "asset-1", currency: "USD", externalId: "1" }]);
    vi.mocked(db.update).mockClear();
    vi.mocked(db.delete).mockClear();

    await expect(
      upsertAsset({ symbol: "BTC", name: "Bitcoin", type: "crypto", externalId: "145" })
    ).resolves.toBe("asset-1");

    expect(db.update).not.toHaveBeenCalled();
    expect(db.delete).not.toHaveBeenCalled();
  });
});

describe("updateTransaction", () => {
  it("throws when the transaction does not exist", async () => {
    selectResolves([]);
    await expect(updateTransaction("user-1", "tx-1", data)).rejects.toThrow("Not found");
    expect(assertOwnedPortfolio).not.toHaveBeenCalled();
  });

  it("rejects a user who does not own the transaction's portfolio", async () => {
    selectResolves([{ portfolioId: "port-1" }]);
    assertOwnedPortfolio.mockRejectedValueOnce(new Error("Unauthorized"));
    await expect(updateTransaction("user-other", "tx-1", data)).rejects.toThrow("Unauthorized");
    expect(assertOwnedPortfolio).toHaveBeenCalledWith("port-1", "user-other");
  });

  it("updates when the owner passes and does not re-assert the same portfolio", async () => {
    selectResolves([{ portfolioId: "port-1" }]);
    assertOwnedPortfolio.mockResolvedValueOnce(undefined);
    const update = vi.mocked(db.update).mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    } as never);
    await expect(updateTransaction("user-1", "tx-1", data)).resolves.toBeUndefined();
    expect(assertOwnedPortfolio).toHaveBeenCalledWith("port-1", "user-1");
    expect(update).toHaveBeenCalled();
  });
});
