import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { assets, portfolios, transactions } from "@/lib/db/schema";
import { assertOwnedPortfolio } from "@/lib/services/portfolio-service";
import {
  createTransactionSchema,
  type CreateTransactionInput,
  type UpsertAssetInput,
} from "@/lib/validators/transaction.schema";

export type ImportRow = {
  symbol: string;
  name?: string;
  assetType: "stock" | "etf" | "crypto";
  type: "buy" | "sell" | "dividend";
  quantity: number;
  price: number;
  fee?: number;
  occurredAt: string; // ISO date
};

/** find-or-create by (symbol, type) — asset rows are shared across users */
export async function upsertAsset(input: UpsertAssetInput): Promise<string> {
  const [existing] = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.symbol, input.symbol), eq(assets.type, input.type)))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(assets)
    .values({
      symbol: input.symbol,
      name: input.name || input.symbol,
      type: input.type,
      currency: input.currency?.toUpperCase() ?? "USD",
      externalId:
        input.externalId ??
        (input.type === "crypto" ? input.symbol.toLowerCase() : null),
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
        : undefined, // stock/ETF currency auto-detected on first quote fetch
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
      currency: d.assetType === "crypto" ? "USD" : undefined,
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
    });
    imported++;
  }
  return { imported, errors };
}
