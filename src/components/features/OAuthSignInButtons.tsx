"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

import type { OAuthProviderId } from "@/lib/auth-providers";
import { oauthProviderLabels } from "@/lib/auth-providers";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type OAuthSignInButtonsProps = {
  providers: OAuthProviderId[];
};

export function OAuthSignInButtons({ providers }: OAuthSignInButtonsProps) {
  const [pendingProvider, setPendingProvider] = useState<OAuthProviderId | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (providers.length === 0) return null;

  async function handleSignIn(provider: OAuthProviderId) {
    setPendingProvider(provider);
    setError(null);
    try {
      await signIn(provider, { redirectTo: "/dashboard" });
    } catch {
      setPendingProvider(null);
      setError("Unable to start sign-in. Please try again.");
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <Separator className="flex-1" />
        <span>Or sign in with</span>
        <Separator className="flex-1" />
      </div>
      {providers.map((provider) => (
        <Button
          key={provider}
          type="button"
          variant="outline"
          className="w-full"
          disabled={pendingProvider !== null}
          onClick={() => void handleSignIn(provider)}
        >
          {pendingProvider === provider
            ? `Connecting to ${oauthProviderLabels[provider]}…`
            : `Continue with ${oauthProviderLabels[provider]}`}
        </Button>
      ))}
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
