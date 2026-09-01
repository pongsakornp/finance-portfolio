import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const onConflictDoUpdate = vi.fn();
  const values = vi.fn(() => ({ onConflictDoUpdate }));
  const insert = vi.fn(() => ({ values }));
  return { insert, values, onConflictDoUpdate };
});

vi.mock("@/lib/db", () => ({ db: { insert: m.insert, select: vi.fn() } }));

import { refreshFundCatalog } from "@/lib/services/fund-catalog-service";

describe("refreshFundCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { short_code: "B-EQUITY", name_th: "กองทุนเปิดบัวหลวงหุ้นทุน" },
          { short_code: "K-EQUITY", name_th: "กองทุนเปิดเค หุ้นทุน" },
          { short_code: null, name_th: "ignored" },
          { name_th: "ignored-too" },
        ],
      }),
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("upserts short_code→name for every valid Finnomena row", async () => {
    await refreshFundCatalog();
    expect(m.insert).toHaveBeenCalledTimes(2);
    expect(m.values).toHaveBeenCalledWith({ shortCode: "B-EQUITY", name: "กองทุนเปิดบัวหลวงหุ้นทุน" });
    expect(m.values).toHaveBeenCalledWith({ shortCode: "K-EQUITY", name: "กองทุนเปิดเค หุ้นทุน" });
    expect(m.onConflictDoUpdate).toHaveBeenCalledTimes(2);
  });
});
