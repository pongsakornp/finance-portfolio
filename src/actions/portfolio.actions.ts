"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { portfolios } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";

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

export async function renamePortfolioAction(id: string, formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "Name required (max 60)" };

  await db
    .update(portfolios)
    .set({ name })
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
  revalidatePath("/portfolios");
  revalidatePath("/dashboard");
  return { ok: true };
}
