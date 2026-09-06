import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import LINE from "next-auth/providers/line";

import { authConfig } from "@/lib/auth.config";
import {
  isGoogleOAuthConfigured,
  isLineOAuthConfigured,
  type OAuthProviderId,
} from "@/lib/auth-providers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { resolveOAuthUser, type OAuthIdentity } from "@/lib/services/oauth-account-service";
import { eq } from "drizzle-orm";

function isOAuthProvider(provider: string): provider is OAuthProviderId {
  return provider === "google" || provider === "line";
}

function oauthIdentity(
  provider: OAuthProviderId,
  providerAccountId: string,
  profile: unknown
): OAuthIdentity | null {
  if (!profile || typeof profile !== "object") return null;
  const data = profile as Record<string, unknown>;
  const email = typeof data.email === "string" ? data.email.trim() : "";
  if (!email || (provider === "google" && data.email_verified !== true)) return null;

  return {
    provider,
    providerAccountId,
    email,
    name: typeof data.name === "string" ? data.name : null,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (!user) return null;

        if (!user.passwordHash) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        return ok ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
    ...(isGoogleOAuthConfigured()
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID!,
            clientSecret: process.env.AUTH_GOOGLE_SECRET!,
          }),
        ]
      : []),
    ...(isLineOAuthConfigured()
      ? [
          LINE({
            clientId: process.env.AUTH_LINE_ID!,
            clientSecret: process.env.AUTH_LINE_SECRET!,
            authorization: { params: { scope: "openid profile email" } },
          }),
        ]
      : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }) {
      if (!account || !isOAuthProvider(account.provider)) return true;
      return Boolean(oauthIdentity(account.provider, account.providerAccountId, profile));
    },
    async jwt({ token, user, account, profile }) {
      if (account && isOAuthProvider(account.provider)) {
        const identity = oauthIdentity(account.provider, account.providerAccountId, profile);
        if (identity) token.id = (await resolveOAuthUser(identity)).id;
      } else if (user) {
        token.id = user.id;
      }
      return token;
    },
  },
});
