import { describe, expect, it } from "vitest";

import { createTransactionSchema } from "@/lib/validators/transaction.schema";

describe("createTransactionSchema", () => {
  const base = {
    portfolioId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    symbol: "AAPL",
    assetType: "stock",
    quantity: 10,
    occurredAt: "2026-01-01T00:00:00.000Z",
  };

  it("rejects buy transaction with price 0", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      type: "buy",
      price: 0,
    });
    expect(res.success).toBe(false);
  });

  it("rejects sell transaction with price 0", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      type: "sell",
      price: 0,
    });
    expect(res.success).toBe(false);
  });

  it("accepts dividend transaction with price 0", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      type: "dividend",
      price: 0,
    });
    expect(res.success).toBe(true);
  });

  it("normalizes symbol to uppercase", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      symbol: "aapl",
      type: "buy",
      price: 150,
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.symbol).toBe("AAPL");
    }
  });

  it("accepts an optional market value", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      type: "buy",
      price: 150,
      market: "SET",
    });
    expect(res.success).toBe(true);
  });

  it("rejects an unknown market value", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      type: "buy",
      price: 150,
      market: "SGP",
    });
    expect(res.success).toBe(false);
  });

  it("rejects non-finite quantities and prices", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      type: "buy",
      price: Infinity,
      quantity: Infinity,
    });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid date", () => {
    const res = createTransactionSchema.safeParse({
      ...base,
      type: "buy",
      price: 150,
      occurredAt: "not-a-date",
    });
    expect(res.success).toBe(false);
  });
});
