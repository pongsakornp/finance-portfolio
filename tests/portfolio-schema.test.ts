import { describe, expect, it } from "vitest";

import { reorderPortfoliosSchema } from "@/lib/validators/portfolio.schema";

const first = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const second = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";

describe("reorderPortfoliosSchema", () => {
  it("accepts a complete ordered list of unique portfolio IDs", () => {
    const result = reorderPortfoliosSchema.safeParse({ orderedIds: [second, first] });
    expect(result.success).toBe(true);
  });

  it("rejects duplicate portfolio IDs", () => {
    const result = reorderPortfoliosSchema.safeParse({ orderedIds: [first, first] });
    expect(result.success).toBe(false);
  });

  it("rejects an empty or malformed order", () => {
    expect(reorderPortfoliosSchema.safeParse({ orderedIds: [] }).success).toBe(false);
    expect(reorderPortfoliosSchema.safeParse({ orderedIds: ["not-a-uuid"] }).success).toBe(false);
  });
});
