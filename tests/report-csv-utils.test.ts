import { describe, expect, it } from "vitest";

import { monthlyBreakdown } from "@/lib/services/report-service";
import { toCsv } from "@/lib/utils/csv";
import { fmtPct } from "@/lib/utils/money";

describe("monthlyBreakdown", () => {
  it("aggregates by month and sorts newest first", () => {
    const rows = monthlyBreakdown([
      { type: "buy", quantity: 2, price: 50, fee: 1, occurredAt: new Date("2026-01-15") }, // invested 101, fee 1
      { type: "dividend", quantity: 7, price: 0, fee: 0, occurredAt: new Date("2026-01-20") },
      { type: "sell", quantity: 1, price: 60, fee: 1, occurredAt: new Date("2026-02-01") }, // proceeds 59, fee 1
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].month).toBe("2026-02");
    expect(rows[0].soldProceeds).toBe(59);
    expect(rows[0].fees).toBe(1);
    expect(rows[0].realizedPL).toBe(8.5); // 1 * (60 - 50.5) - 1 = 8.5
    expect(rows[1].invested).toBe(101);
    expect(rows[1].dividends).toBe(7);
    expect(rows[1].fees).toBe(1);
  });
});

describe("toCsv", () => {
  it("escapes commas and quotes", () => {
    expect(toCsv([["a", "b,c"], ['say "hi"', 3]])).toBe(
      'a,"b,c"\n"say ""hi""",3'
    );
  });
});

describe("fmtPct", () => {
  it("signs positive values", () => {
    expect(fmtPct(1.234)).toBe("+1.23%");
    expect(fmtPct(-2)).toBe("-2.00%");
  });
});
