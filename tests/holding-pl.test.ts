import { describe, expect, it } from "vitest";

import { avatarText, holdingPl } from "@/lib/utils/holdings";

const row = {
  unrealizedPlUsd: 5380.2,
  dayChangeUsd: (769.35 - 755.0) * 15,
  unrealizedPLPct: 87.34,
  dayChangePct: ((769.35 - 755.0) / 755.0) * 100,
};

describe("holdingPl", () => {
  it("returns unrealized (since open) by default", () => {
    const r = holdingPl(row, 1, "unrealized");
    expect(r.pl).toBeCloseTo(5380.2);
    expect(r.plPct).toBeCloseTo(87.34);
  });

  it("returns daily change when plView is 'daily'", () => {
    const r = holdingPl(row, 1, "daily");
    expect(r.pl).toBeCloseTo((769.35 - 755.0) * 15);
    expect(r.plPct).toBeCloseTo(((769.35 - 755.0) / 755.0) * 100);
  });

  it("applies the fx rate to the amount", () => {
    const r = holdingPl(row, 30, "daily");
    expect(r.pl).toBeCloseTo((769.35 - 755.0) * 15 * 30);
  });

  it("is zero for daily when dayChangeUsd is zero", () => {
    const r = holdingPl(
      { ...row, dayChangeUsd: 0, dayChangePct: 0 },
      30,
      "daily"
    );
    expect(r.pl).toBe(0);
    expect(r.plPct).toBe(0);
  });

  it("does not inflate a THB asset (native P/L is USD-space, not re-multiplied)", () => {
    // 10,000 × ฿10.90 = ฿109,000 market value; 10,000 × ฿28.55 = ฿285,500 cost
    // native→USD 0.03 → valueUsd 3270, costUsd 8565, unrealizedPlUsd -5295 USD
    const r = holdingPl(
      { unrealizedPlUsd: -5295, dayChangeUsd: 0, unrealizedPLPct: -61.82, dayChangePct: 0 },
      33, // THB per USD
      "unrealized"
    );
    // base P/L = USD × THB/USD ≈ native THB loss (×33 once, not ×33²)
    expect(r.pl).toBeCloseTo(-174735);
    expect(r.plPct).toBeCloseTo(-61.82);
  });
});

describe("avatarText", () => {
  it("strips a dot suffix", () => {
    expect(avatarText("PTT.BK")).toBe("PTT");
    expect(avatarText("TDEX.BK")).toBe("TDEX");
  });
  it("uses the first character for long names", () => {
    expect(avatarText("B-EQUITY")).toBe("B");
  });
  it("keeps short symbols as-is", () => {
    expect(avatarText("SPY")).toBe("SPY");
    expect(avatarText("AAPL")).toBe("AAPL");
  });
});
