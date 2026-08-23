"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { generateApiKey } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";

export async function createApiKeyAction(name: string) {
  const userId = await requireUserId();
  const clean = name.trim();
  if (!clean || clean.length > 40) return { error: "Name required (max 40)" };

  const { token, keyHash, prefix } = generateApiKey();
  await db
    .insert(apiKeys)
    .values({ userId, name: clean, keyHash, prefix });
  revalidatePath("/settings");
  return { ok: true as const, token };
}

export async function revokeApiKeyAction(id: string) {
  const userId = await requireUserId();
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKeys.id, id),
        eq(apiKeys.userId, userId),
        isNull(apiKeys.revokedAt)
      )
    );
  revalidatePath("/settings");
  return { ok: true as const };
}
