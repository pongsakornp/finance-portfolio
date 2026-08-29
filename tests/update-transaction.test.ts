import { describe, expect, it, vi } from "vitest";

const assertOwnedPortfolio = vi.hoisted(() =>
  vi.fn().mockResolvedValue(undefined)
);

vi.mock("@/lib/services/portfolio-service", () => ({ assertOwnedPortfolio }));

vi.mock("@/lib/db", () => ({ db: { select: vi.fn(), update: vi.fn() } }));

import { db } from "@/lib/db";
import { updateTransaction } from "@/lib/services/transaction-service";

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
