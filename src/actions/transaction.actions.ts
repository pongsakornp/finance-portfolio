"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { portfolios } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import {
  createTransaction,
  deleteTransaction,
  importTransactions,
  type ImportRow,
} from "@/lib/services/transaction-service";
import { createTransactionSchema } from "@/lib/validators/transaction.schema";

export type { ImportRow };

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/portfolios");
  revalidatePath("/reports");
}

export async function createPortfolioAction(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Name required (max 60)" };

  await db.insert(portfolios).values({ userId, name });
  revalidatePath("/portfolios");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deletePortfolioAction(id: string) {
  const userId = await requireUserId();
  await db
    .delete(portfolios)
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
  revalidatePath("/portfolios");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createTransactionAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createTransactionSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    assetName: formData.get("assetName") || undefined,
    externalId: formData.get("externalId") || undefined,
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

  try {
    await createTransaction(userId, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save" };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteTransactionAction(id: string) {
  const userId = await requireUserId();
  try {
    await deleteTransaction(id, userId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Not found" };
  }
  revalidateAll();
  return { ok: true };
}

export async function importTransactionsAction(
  rows: ImportRow[],
  portfolioId: string
) {
  const userId = await requireUserId();
  try {
    const result = await importTransactions(rows, portfolioId, userId);
    revalidateAll();
    return result;
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Import failed",
      imported: 0,
      errors: [],
    };
  }
}
