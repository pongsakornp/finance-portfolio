import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { assets, portfolios, transactions } from "@/lib/db/schema";
import { getRate } from "@/lib/services/fx-service";
import { getQuote } from "@/lib/services/quote-service";
import {
  computePosition,
  computeTotals,
  type Position,
  type Totals,
} from "@/lib/services/holdings-service";
import type { Asset } from "@/lib/services/quote-service";

export type TxRow = typeof transactions.$inferSelect & { asset: Asset };

export async function getUserTransactions(
  userId?: string,
  portfolioId?: string
): Promise<TxRow[]> {
  const whereClause =
    userId && portfolioId
      ? and(eq(portfolios.userId, userId), eq(transactions.portfolioId, portfolioId))
      : userId
        ? eq(portfolios.userId, userId)
        : portfolioId
          ? eq(transactions.portfolioId, portfolioId)
          : undefined;

  const rows = await db
    .select({ tx: transactions, asset: assets })
    .from(transactions)
    .innerJoin(assets, eq(assets.id, transactions.assetId))
    .innerJoin(portfolios, eq(portfolios.id, transactions.portfolioId))
    .where(whereClause)
    .orderBy(asc(transactions.occurredAt));
  return rows.map((r) => ({ ...r.tx, asset: r.asset }));
}

export async function getUserPortfolios(userId: string) {
  return db.select().from(portfolios).where(eq(portfolios.userId, userId));
}

export type HoldingRow = {
  asset: Asset;
  price: number;
  previousClose: number | null;
  position: Position;
  valueUsd: number;
  costUsd: number;
  unrealizedPlUsd: number;
  dayChangeUsd: number;
  dayChangePct: number;
  firstBuyAt: Date;
};

export type HoldingsView = {
  rows: HoldingRow[];
  totalsUsd: Totals;
};

/**
 * Groups transactions per asset, computes avg-cost positions with live quotes,
 * normalizes everything to USD (display layer converts to the user's base currency).
 */
export async function buildHoldingsView(txs: TxRow[]): Promise<HoldingsView> {
  const byAsset = new Map<string, TxRow[]>();
  for (const tx of txs) {
    const list = byAsset.get(tx.asset.id) ?? [];
    list.push(tx);
    byAsset.set(tx.asset.id, list);
  }

  const usdRates = new Map<string, number>();
  const currencies = new Set<string>();
  byAsset.forEach((list) => {
    const cur = list[0].asset.currency;
    if (cur !== "USD") currencies.add(cur);
  });
  await Promise.all(
    [...currencies].map(async (cur) =>
      usdRates.set(cur, (await getRate(cur, "USD")).toNumber())
    )
  );

  const entries = [...byAsset.entries()];
  // A single failing quote (offline/unmapped coin, rate-limit) must not 500
  // the whole page — isolate each one and skip holdings with no price.
  const quotes = await Promise.all(
    entries.map(([, list]) => getQuote(list[0].asset).catch(() => null))
  );

  const rows: HoldingRow[] = [];
  for (let i = 0; i < entries.length; i++) {
    const [, list] = entries[i];
    const quote = quotes[i];
    if (!quote) continue; // no price → cannot value → omit this holding
    const asset = list[0].asset;
    // chronological order matters for average cost
    const sorted = [...list].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
    );
    const position = computePosition(sorted, quote.price);
    const rate = asset.currency === "USD" ? 1 : (usdRates.get(asset.currency) ?? 1);
    const valueUsd = Math.round(position.marketValue * rate * 100) / 100;
    const costUsd = Math.round(position.costBasis * rate * 100) / 100;
    const prev = quote.previousClose;
    rows.push({
      asset,
      price: quote.price,
      previousClose: quote.previousClose,
      position,
      valueUsd,
      costUsd,
      unrealizedPlUsd: Math.round((valueUsd - costUsd) * 100) / 100,
      dayChangeUsd:
        prev != null ? Math.round((quote.price - prev) * position.qty * rate * 100) / 100 : 0,
      dayChangePct:
        prev != null && prev > 0
          ? parseFloat(((quote.price - prev) / prev * 100).toFixed(2))
          : 0,
      firstBuyAt: sorted[0].occurredAt,
    });
  }

  // recompute grand totals in USD space
  const totalsUsd = computeTotals(
    rows.map((r) => {
      const rate = r.asset.currency === "USD" ? 1 : (usdRates.get(r.asset.currency) ?? 1);
      return {
        position: {
          ...r.position,
          costBasis: r.costUsd,
          marketValue: r.valueUsd,
          unrealizedPL: Math.round((r.valueUsd - r.costUsd) * 100) / 100,
          realizedPL: Math.round(r.position.realizedPL * rate * 100) / 100,
          dividendsReceived: Math.round(r.position.dividendsReceived * rate * 100) / 100,
        },
        previousClose: r.previousClose !== null ? r.previousClose * rate : null,
      };
    })
  );

  return { rows, totalsUsd };
}
