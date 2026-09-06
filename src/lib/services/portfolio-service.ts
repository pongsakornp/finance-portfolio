import { and, eq, sql } from "drizzle-orm";

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

export async function createPortfolio(userId: string, name: string) {
  return db.transaction(async (tx) => {
    const [last] = await tx
      .select({ sortOrder: sql<number>`coalesce(max(${portfolios.sortOrder}), -1)` })
      .from(portfolios)
      .where(eq(portfolios.userId, userId));
    const [created] = await tx
      .insert(portfolios)
      .values({ userId, name, sortOrder: (last?.sortOrder ?? -1) + 1 })
      .returning({ id: portfolios.id, name: portfolios.name, sortOrder: portfolios.sortOrder });
    return created;
  });
}

export async function deletePortfolio(portfolioId: string, userId: string) {
  const [deleted] = await db
    .delete(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning({ id: portfolios.id });
  if (!deleted) throw new Error("Portfolio not found");
}

export async function renamePortfolio(portfolioId: string, userId: string, name: string) {
  const [updated] = await db
    .update(portfolios)
    .set({ name })
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .returning({ id: portfolios.id, name: portfolios.name });
  if (!updated) throw new Error("Portfolio not found");
  return updated;
}

/** Persists a complete, user-owned portfolio order as sequential positions. */
export async function reorderPortfolios(userId: string, orderedIds: string[]) {
  await db.transaction(async (tx) => {
    const owned = await tx
      .select({ id: portfolios.id })
      .from(portfolios)
      .where(eq(portfolios.userId, userId));
    const ownedIds = new Set(owned.map((portfolio) => portfolio.id));
    if (
      ownedIds.size !== orderedIds.length ||
      orderedIds.some((portfolioId) => !ownedIds.has(portfolioId))
    ) {
      throw new Error("Portfolio order does not match your portfolios");
    }

    for (const [sortOrder, portfolioId] of orderedIds.entries()) {
      await tx
        .update(portfolios)
        .set({ sortOrder })
        .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)));
    }
  });
}
