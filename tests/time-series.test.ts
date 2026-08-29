import { describe, expect, it } from "vitest";

import { quoteSeriesDay } from "@/lib/services/quote-service";

describe("quoteSeriesDay", () => {
  const wed = new Date("2026-08-26T12:00:00Z"); // Wed
  const sat = new Date("2026-08-22T12:00:00Z"); // Sat

  it("appends every day for crypto (24/7)", () => {
    expect(quoteSeriesDay("crypto", sat)).toBe("2026-08-22");
    expect(quoteSeriesDay("crypto", wed)).toBe("2026-08-26");
  });

  it("appends weekdays for market-hours assets", () => {
    expect(quoteSeriesDay("stock", wed)).toBe("2026-08-26");
    expect(quoteSeriesDay("etf", wed)).toBe("2026-08-26");
    expect(quoteSeriesDay("mutualfund", wed)).toBe("2026-08-26");
  });

  it("skips weekends for market-hours assets (no spurious points)", () => {
    expect(quoteSeriesDay("stock", sat)).toBeNull();
    expect(quoteSeriesDay("etf", sat)).toBeNull();
    expect(quoteSeriesDay("mutualfund", sat)).toBeNull();
  });
});
