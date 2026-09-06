import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { oauthAccounts, users } from "@/lib/db/schema";
import type { OAuthProviderId } from "@/lib/auth-providers";

export type OAuthIdentity = {
  provider: OAuthProviderId;
  providerAccountId: string;
  email: string;
  name: string | null;
};

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Resolves an OAuth identity to the application's UUID. A matching verified
 * email intentionally links to the existing credentials account.
 */
export async function resolveOAuthUser(identity: OAuthIdentity): Promise<{ id: string }> {
  const email = normalizedEmail(identity.email);

  return db.transaction(async (tx) => {
    const [linkedAccount] = await tx
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, identity.provider),
          eq(oauthAccounts.providerAccountId, identity.providerAccountId)
        )
      )
      .limit(1);
    if (linkedAccount) return { id: linkedAccount.userId };

    const [matchingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    const userId = matchingUser?.id ?? (
      await tx
        .insert(users)
        .values({ email, name: identity.name, passwordHash: null })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id })
    )[0]?.id;

    if (userId) {
      const [linked] = await tx
        .insert(oauthAccounts)
        .values({
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
          userId,
        })
        .onConflictDoNothing({
          target: [oauthAccounts.provider, oauthAccounts.providerAccountId],
        })
        .returning({ userId: oauthAccounts.userId });
      if (linked) return { id: linked.userId };
    }

    // A concurrent login may have created the user or provider link first.
    const [resolvedAccount] = await tx
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, identity.provider),
          eq(oauthAccounts.providerAccountId, identity.providerAccountId)
        )
      )
      .limit(1);
    if (resolvedAccount) return { id: resolvedAccount.userId };

    const [resolvedUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!resolvedUser) throw new Error("Unable to resolve OAuth user");

    await tx.insert(oauthAccounts).values({
      provider: identity.provider,
      providerAccountId: identity.providerAccountId,
      userId: resolvedUser.id,
    });
    return { id: resolvedUser.id };
  });
}
