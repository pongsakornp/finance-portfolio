import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { portfolios } from "@/lib/db/schema";

/** Shared ownership gate for portfolio-scoped mutations (actions + MCP tools). */
export async function assertOwnedPortfolio(
  portfolioId: string,
  userId: string
): Promise<void> {
  const [p] = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (!p) throw new Error("Portfolio not found");
}
