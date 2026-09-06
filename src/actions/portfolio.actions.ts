"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/session";
import {
  createPortfolioSchema,
  deletePortfolioSchema,
  reorderPortfoliosSchema,
  renamePortfolioSchema,
} from "@/lib/validators/portfolio.schema";
import {
  createPortfolio,
  deletePortfolio,
  renamePortfolio,
  reorderPortfolios,
} from "@/lib/services/portfolio-service";

function revalidatePortfolioViews() {
  revalidatePath("/portfolios");
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/settings");
}

export async function createPortfolioAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = createPortfolioSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  try {
    await createPortfolio(userId, parsed.data.name);
    revalidatePortfolioViews();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create portfolio" };
  }
}

export async function deletePortfolioAction(id: string) {
  const userId = await requireUserId();
  const parsed = deletePortfolioSchema.safeParse({ id });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid portfolio ID" };
  }

  try {
    await deletePortfolio(parsed.data.id, userId);
    revalidatePortfolioViews();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to delete portfolio" };
  }
}

export async function renamePortfolioAction(id: string, formData: FormData) {
  const userId = await requireUserId();
  const parsed = renamePortfolioSchema.safeParse({
    id,
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  try {
    await renamePortfolio(parsed.data.id, userId, parsed.data.name);
    revalidatePortfolioViews();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to rename portfolio" };
  }
}

export async function reorderPortfoliosAction(orderedIds: string[]) {
  const userId = await requireUserId();
  const parsed = reorderPortfoliosSchema.safeParse({ orderedIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid portfolio order" };
  }

  try {
    await reorderPortfolios(userId, parsed.data.orderedIds);
    revalidatePortfolioViews();
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to reorder portfolios" };
  }
}
