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
  it("updates an existing cash asset's currency when it differs", async () => {
    selectResolves([{ id: "asset-1", currency: "USD" }]);
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockImplementation(() => ({ set } as never));

    await expect(
      upsertAsset({
        symbol: "KBank",
        name: "KBank",
        type: "cash",
        currency: "THB",
      })
    ).resolves.toBe("asset-1");

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ currency: "THB" }));
  });

  it("does not touch currency when it already matches", async () => {
    selectResolves([{ id: "asset-1", currency: "THB" }]);
    vi.mocked(db.update).mockClear();

    await expect(
      upsertAsset({
        symbol: "KBank",
        name: "KBank",
        type: "cash",
        currency: "THB",
      })
    ).resolves.toBe("asset-1");

    expect(db.update).not.toHaveBeenCalled();
  });

  it("persists a new CoinGecko id on an existing crypto asset and flushes its cached quote", async () => {
    selectResolves([{ id: "asset-1", currency: "USD", externalId: "bitcoin" }]);
    const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    vi.mocked(db.update).mockImplementation(() => ({ set } as never));
    const del = vi.fn().mockResolvedValue(undefined);
    vi.mocked(db.delete).mockImplementation(() => ({ where: del } as never));

    await expect(
      upsertAsset({ symbol: "BTC", name: "Bitcoin", type: "crypto", externalId: "bitcoin-cash" })
    ).resolves.toBe("asset-1");

    expect(set).toHaveBeenCalledWith(expect.objectContaining({ externalId: "bitcoin-cash" }));
    expect(del).toHaveBeenCalled();
  });

  it("does not touch externalId or the cache when the id is unchanged", async () => {
    selectResolves([{ id: "asset-1", currency: "USD", externalId: "bitcoin" }]);
    vi.mocked(db.update).mockClear();
    vi.mocked(db.delete).mockClear();

    await expect(
      upsertAsset({ symbol: "BTC", name: "Bitcoin", type: "crypto", externalId: "bitcoin" })
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
