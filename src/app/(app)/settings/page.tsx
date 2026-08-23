import { desc, eq } from "drizzle-orm";

import { ApiKeysCard } from "@/components/features/api-keys-card";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const keys = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <ApiKeysCard
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revoked: k.revokedAt !== null,
        }))}
      />
    </div>
  );
}
