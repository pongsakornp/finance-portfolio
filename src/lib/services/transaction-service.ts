import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { assets, portfolios, priceCache, transactions } from "@/lib/db/schema";
import { assertOwnedPortfolio } from "@/lib/services/portfolio-service";
import {
  ASSET_TYPES,
  createTransactionSchema,
  type CreateTransactionInput,
  type UpsertAssetInput,
} from "@/lib/validators/transaction.schema";

export type ImportRow = {
  symbol: string;
  name?: string;
  assetName?: string;
  assetType: (typeof ASSET_TYPES)[number];
  type: "buy" | "sell" | "dividend";
  quantity: number;
  price: number;
  fee?: number;
  occurredAt: string; // ISO date
  currency?: string; // cash only (legacy/CSV alias)
  assetCurrency?: string; // cash only
  market?: "US" | "SET";
  note?: string;
  externalId?: string;
};

/** find-or-create by (symbol, type) — asset rows are shared across users */
export async function upsertAsset(input: UpsertAssetInput): Promise<string> {
  const [existing] = await db
    .select({ id: assets.id, currency: assets.currency, market: assets.market, externalId: assets.externalId })
    .from(assets)
    .where(and(eq(assets.symbol, input.symbol), eq(assets.type, input.type)))
    .limit(1);
  if (existing) {
    // keep the asset's currency current when a cash edit changes it (find-or-create
    // matches on symbol+type only, so a currency change would otherwise be silently lost)
    if (input.currency && existing.currency !== input.currency) {
      await db.update(assets).set({ currency: input.currency }).where(eq(assets.id, existing.id));
    }
    // keep the asset's market current (same find-or-create caveat) — SET assets must
    // be fetched Finnomena-first and valued as THB.
    if (input.market && existing.market !== input.market) {
      await db.update(assets).set({ market: input.market }).where(eq(assets.id, existing.id));
    }
    // persist an explicit CoinGecko id (the crypto pricing source) — the id is not part
    // of the find-or-create key, so without this an edit would be silently dropped.
    // Flush the cached quote so the new id takes effect immediately (bypasses the TTL).
    if (input.externalId && existing.externalId !== input.externalId) {
      await db.update(assets).set({ externalId: input.externalId }).where(eq(assets.id, existing.id));
      await db.delete(priceCache).where(eq(priceCache.assetId, existing.id));
    }
    return existing.id;
  }

  const [created] = await db
    .insert(assets)
    .values({
      symbol: input.symbol,
      name: input.name || input.symbol,
      type: input.type,
      currency: input.currency?.toUpperCase() ?? "USD",
      market: input.market ?? "US",
      externalId: input.externalId ?? null,
    })
    .returning({ id: assets.id });
  return created.id;
}

export async function createTransaction(
  userId: string,
  data: CreateTransactionInput
): Promise<void> {
  await assertOwnedPortfolio(data.portfolioId, userId);
  const assetId = await upsertAsset({
    symbol: data.symbol,
    name: data.assetName ?? "",
    type: data.assetType,
    currency:
      data.assetType === "crypto"
        ? "USD"
        : data.assetType === "cash"
          ? (data.assetCurrency?.toUpperCase() ?? "USD")
          : data.assetType === "mutualfund"
            ? "THB"
            : data.market === "SET"
              ? "THB" // SET assets are Baht-denominated
              : undefined, // stock/ETF/commodity currency auto-detected on first quote fetch
    market: data.market ?? "US",
    externalId: data.externalId,
  });

  await db.insert(transactions).values({
    portfolioId: data.portfolioId,
    assetId,
    type: data.type,
    quantity: String(data.quantity),
    price: String(data.price),
    fee: String(data.fee),
    occurredAt: data.occurredAt,
    note: data.note,
  });
}

export async function deleteTransaction(
  id: string,
  userId: string
): Promise<void> {
  // scoped delete via join-free two-step: find tx's portfolio, verify owner
  const [row] = await db
    .select({ portfolioId: transactions.portfolioId })
    .from(transactions)
    .innerJoin(portfolios, eq(portfolios.id, transactions.portfolioId))
    .where(eq(transactions.id, id))
    .limit(1);
  if (!row) throw new Error("Not found");

  await assertOwnedPortfolio(row.portfolioId, userId);
  await db.delete(transactions).where(eq(transactions.id, id));
}

export async function updateTransaction(
  userId: string,
  id: string,
  data: CreateTransactionInput
): Promise<void> {
  const [row] = await db
    .select({ portfolioId: transactions.portfolioId })
    .from(transactions)
    .where(eq(transactions.id, id))
    .limit(1);
  if (!row) throw new Error("Not found");

  // must own the transaction's current portfolio...
  await assertOwnedPortfolio(row.portfolioId, userId);
  // ...and the destination portfolio if the user is moving it
  if (data.portfolioId !== row.portfolioId) {
    await assertOwnedPortfolio(data.portfolioId, userId);
  }

  const assetId = await upsertAsset({
    symbol: data.symbol,
    name: data.assetName ?? "",
    type: data.assetType,
    currency:
      data.assetType === "crypto"
        ? "USD"
        : data.assetType === "cash"
          ? (data.assetCurrency?.toUpperCase() ?? "USD")
          : data.assetType === "mutualfund"
            ? "THB"
            : data.market === "SET"
              ? "THB"
              : undefined,
    market: data.market ?? "US",
    externalId: data.externalId,
  });

  await db
    .update(transactions)
    .set({
      portfolioId: data.portfolioId,
      assetId,
      type: data.type,
      quantity: String(data.quantity),
      price: String(data.price),
      fee: String(data.fee),
      occurredAt: data.occurredAt,
      note: data.note,
    })
    .where(eq(transactions.id, id));
}

export async function importTransactions(
  rows: ImportRow[],
  portfolioId: string,
  userId: string
): Promise<{ imported: number; errors: string[] }> {
  await assertOwnedPortfolio(portfolioId, userId);

  let imported = 0;
  const errors: string[] = [];

  for (const [i, row] of rows.entries()) {
    const parsed = createTransactionSchema.safeParse({
      ...row,
      portfolioId,
      occurredAt: new Date(row.occurredAt),
      assetName: row.assetName ?? row.name,
      assetCurrency: row.assetCurrency ?? row.currency,
    });
    if (!parsed.success) {
      errors.push(`Row ${i + 2}: ${parsed.error.issues[0]?.message}`);
      continue;
    }
    const d = parsed.data;
    const assetId = await upsertAsset({
      symbol: d.symbol,
      name: d.assetName ?? "",
      type: d.assetType,
      currency:
        d.assetType === "crypto"
          ? "USD"
          : d.assetType === "cash"
            ? (d.assetCurrency?.toUpperCase() ?? "USD")
            : d.assetType === "mutualfund"
              ? "THB"
              : d.market === "SET"
                ? "THB"
                : undefined,
      market: d.market ?? "US",
      externalId: d.externalId,
    });
    await db.insert(transactions).values({
      portfolioId,
      assetId,
      type: d.type,
      quantity: String(d.quantity),
      price: String(d.price),
      fee: String(d.fee ?? 0),
      occurredAt: d.occurredAt,
      note: d.note,
    });
    imported++;
  }
  return { imported, errors };
}
