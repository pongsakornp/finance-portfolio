import { describe, expect, it } from "vitest";

import { isHistoryFresh } from "@/lib/services/valuation-service";

describe("isHistoryFresh", () => {
  const cutoff = "2026-09-03";

  it("uses a recent official close without another full history backfill", () => {
    expect(isHistoryFresh("2026-09-04", cutoff)).toBe(true);
    expect(isHistoryFresh(cutoff, cutoff)).toBe(true);
  });

  it("backfills only missing or genuinely stale history", () => {
    expect(isHistoryFresh("2026-09-02", cutoff)).toBe(false);
    expect(isHistoryFresh(undefined, cutoff)).toBe(false);
  });
});
