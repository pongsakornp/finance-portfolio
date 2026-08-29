import { describe, expect, it } from "vitest";

import { avatarText, holdingPl } from "@/lib/utils/holdings";

const row = {
  price: 769.35,
  previousClose: 755.0,
  position: { qty: 15, unrealizedPL: 5380.2, unrealizedPLPct: 87.34 },
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

  it("falls back to 0 when previousClose is missing", () => {
    const r = holdingPl({ ...row, previousClose: null }, 1, "daily");
    expect(r.pl).toBe(0);
    expect(r.plPct).toBe(0);
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
