import { describe, expect, it, vi } from "vitest";

// cash quote path must not touch the DB (returns before any query)
vi.mock("@/lib/db", () => ({ db: {} }));

import { computePosition } from "@/lib/services/holdings-service";
import { getQuote } from "@/lib/services/quote-service";

const cashAsset = {
  id: "cash-1",
  symbol: "USD",
  name: "Cash (USD)",
  type: "cash",
  currency: "THB",
  externalId: null,
  createdAt: new Date(),
} as never;

describe("cash assets", () => {
  it("quotes at exactly 1 in its own currency with no network call", async () => {
    const q = await getQuote(cashAsset);
    expect(q.price).toBe(1);
    expect(q.previousClose).toBeNull();
    expect(q.currency).toBe("THB");
    expect(q.type).toBe("cash");
  });

  it("treats deposits/withdrawals as buy/sell at price 1", () => {
    const pos = computePosition(
      [
        { type: "buy", quantity: "10000", price: "1", fee: "0" },
        { type: "sell", quantity: "2500", price: "1", fee: "15" },
      ],
      1
    );
    expect(pos.qty).toBe(7500);
    expect(pos.marketValue).toBe(7500);
    expect(pos.unrealizedPL).toBe(0);
    expect(pos.realizedPL).toBe(-15); // withdrawal fee is a realized loss
  });
});
