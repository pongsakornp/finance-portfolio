export const oauthProviderIds = ["google", "line"] as const;

export type OAuthProviderId = (typeof oauthProviderIds)[number];

export const oauthProviderLabels: Record<OAuthProviderId, string> = {
  google: "Google",
  line: "LINE",
};

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
}

export function isLineOAuthConfigured(): boolean {
  return Boolean(process.env.AUTH_LINE_ID && process.env.AUTH_LINE_SECRET);
}

export function getEnabledOAuthProviders(): OAuthProviderId[] {
  return oauthProviderIds.filter((provider) =>
    provider === "google" ? isGoogleOAuthConfigured() : isLineOAuthConfigured()
  );
}
