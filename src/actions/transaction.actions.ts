"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/session";
import {
  createTransaction,
  deleteTransaction,
  importTransactions,
  updateTransaction,
  type ImportRow,
} from "@/lib/services/transaction-service";
import { createTransactionSchema } from "@/lib/validators/transaction.schema";

export type { ImportRow };

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/portfolios");
}

function validationMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues.map((i) => i.message).join("; ") || "Invalid input";
}

export async function createTransactionAction(formData: FormData) {
  const userId = await requireUserId();

  const parsed = createTransactionSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    assetName: formData.get("assetName") || undefined,
    externalId: formData.get("externalId") || undefined,
    market: (formData.get("market") as "US" | "SET") || undefined,
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    fee: formData.get("fee") || 0,
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: validationMessage(parsed.error) };
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

export async function updateTransactionAction(id: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = createTransactionSchema.safeParse({
    portfolioId: formData.get("portfolioId"),
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    assetName: formData.get("assetName") || undefined,
    externalId: formData.get("externalId") || undefined,
    market: (formData.get("market") as "US" | "SET") || undefined,
    type: formData.get("type"),
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    fee: formData.get("fee") || 0,
    occurredAt: formData.get("occurredAt"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) {
    return { error: validationMessage(parsed.error) };
  }

  try {
    await updateTransaction(userId, id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to save" };
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
