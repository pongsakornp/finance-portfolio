import { describe, expect, it } from "vitest";

import { isRateFresh } from "@/lib/services/fx-service";
import { isQuoteFresh } from "@/lib/services/quote-service";

describe("market-data cache freshness", () => {
  const now = new Date("2026-09-06T12:00:00Z").getTime();

  it("uses the shorter crypto quote TTL", () => {
    expect(isQuoteFresh("crypto", new Date(now - 59_000), now)).toBe(true);
    expect(isQuoteFresh("crypto", new Date(now - 60_000), now)).toBe(false);
  });

  it("expires stock quotes after five minutes", () => {
    expect(isQuoteFresh("stock", new Date(now - 299_999), now)).toBe(true);
    expect(isQuoteFresh("stock", new Date(now - 300_000), now)).toBe(false);
  });

  it("expires FX rates after twelve hours", () => {
    expect(isRateFresh(new Date(now - 12 * 60 * 60_000 + 1), now)).toBe(true);
    expect(isRateFresh(new Date(now - 12 * 60 * 60_000), now)).toBe(false);
  });
});
