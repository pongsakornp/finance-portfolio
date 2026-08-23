"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { assets, portfolios, transactions } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import {
  createTransactionSchema,
  ASSET_TYPES,
  type UpsertAssetInput,
} from "@/lib/validators/transaction.schema";

async function assertOwnedPortfolio(portfolioId: string, userId: string) {
  const [p] = await db
    .select({ id: portfolios.id })
    .from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (!p) throw new Error("Portfolio not found");
}

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

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/portfolios");
  revalidatePath("/reports");
}

export async function createTransactionAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createTransactionSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    assetName: formData.get("assetName") || undefined,
    externalId: formData.get("externalId") || undefined,
    assetCurrency: formData.get("assetCurrency") || undefined,
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    fee: formData.get("fee") || 0,
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  try {
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
              ? "THB" // Finnomena NAV is always THB
              : undefined, // stock/ETF/commodity currency auto-detected on first quote fetch
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
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save" };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteTransactionAction(id: string) {
  const userId = await requireUserId();
  // scoped delete via join-free two-step: find tx's portfolio, verify owner
  const [row] = await db
    .select({ portfolioId: transactions.portfolioId })
    .from(transactions)
    .innerJoin(portfolios, eq(portfolios.id, transactions.portfolioId))
    .where(eq(transactions.id, id))
    .limit(1);
  if (!row) return { error: "Not found" };

  await assertOwnedPortfolio(row.portfolioId, userId);
  await db.delete(transactions).where(eq(transactions.id, id));
  revalidateAll();
  return { ok: true };
}

export type ImportRow = {
  symbol: string;
  name?: string;
  assetType: (typeof ASSET_TYPES)[number];
  type: "buy" | "sell" | "dividend";
  quantity: number;
  price: number;
  fee?: number;
  occurredAt: string; // ISO date
  currency?: string; // cash only
};

export async function importTransactionsAction(
  rows: ImportRow[],
  portfolioId: string
) {
  const userId = await requireUserId();
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
      currency:
        d.assetType === "crypto"
          ? "USD"
          : d.assetType === "cash"
            ? (row.currency?.toUpperCase() ?? "USD")
            : d.assetType === "mutualfund"
              ? "THB"
              : undefined,
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
  revalidateAll();
  return { imported, errors };
}
