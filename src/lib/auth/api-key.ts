import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";

export const API_KEY_PREFIX = "skp_";

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Plaintext is shown to the user exactly once at creation; only the hash is stored. */
export function generateApiKey(): { token: string; keyHash: string; prefix: string } {
  const token = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { token, keyHash: hashApiKey(token), prefix: token.slice(0, 12) };
}

/** Bearer token → userId, or null. Stamps lastUsedAt for the settings page. */
export async function resolveApiUser(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith(`Bearer ${API_KEY_PREFIX}`)) return null;
  const token = header.slice(7).trim();
  const tokenHash = hashApiKey(token);

  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, keyHash: apiKeys.keyHash })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, tokenHash), isNull(apiKeys.revokedAt)))
    .limit(1);
  if (!row) return null;

  const a = Buffer.from(row.keyHash, "hex");
  const b = Buffer.from(tokenHash, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await db
    .update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.id));
  return row.userId;
}
