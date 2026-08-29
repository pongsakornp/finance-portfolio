"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { portfolios } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import {
  createPortfolioSchema,
  deletePortfolioSchema,
  renamePortfolioSchema,
} from "@/lib/validators/portfolio.schema";

export async function createPortfolioAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = createPortfolioSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  try {
    await db.insert(portfolios).values({ userId, name: parsed.data.name });
    revalidatePath("/portfolios");
    revalidatePath("/dashboard");
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
    const [deleted] = await db
      .delete(portfolios)
      .where(and(eq(portfolios.id, parsed.data.id), eq(portfolios.userId, userId)))
      .returning({ id: portfolios.id });
    if (!deleted) return { error: "Portfolio not found" };

    revalidatePath("/portfolios");
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
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
    const [updated] = await db
      .update(portfolios)
      .set({ name: parsed.data.name })
      .where(and(eq(portfolios.id, parsed.data.id), eq(portfolios.userId, userId)))
      .returning({ id: portfolios.id });
    if (!updated) return { error: "Portfolio not found" };

    revalidatePath("/portfolios");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to rename portfolio" };
  }
}
