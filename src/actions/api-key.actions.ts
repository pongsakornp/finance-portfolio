"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { generateApiKey } from "@/lib/auth/api-key";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";

const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Name required").max(40, "Max 40 characters"),
});

export async function createApiKeyAction(name: string) {
  const userId = await requireUserId();
  const parsed = createApiKeySchema.safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  try {
    const { token, keyHash, prefix } = generateApiKey();
    await db
      .insert(apiKeys)
      .values({ userId, name: parsed.data.name, keyHash, prefix });
    revalidatePath("/settings");
    return { ok: true as const, token };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create API key" };
  }
}

export async function revokeApiKeyAction(id: string) {
  const userId = await requireUserId();
  if (!id || typeof id !== "string") return { error: "Invalid key ID" };

  try {
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
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to revoke API key" };
  }
}
