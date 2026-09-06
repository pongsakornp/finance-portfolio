"use client";

import Link from "next/link";
import { useActionState } from "react";

import { loginAction, type FormState } from "@/actions/auth.actions";
import { OAuthSignInButtons } from "@/components/features/OAuthSignInButtons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import type { OAuthProviderId } from "@/lib/auth-providers";

export function LoginForm({
  providers,
  oauthError,
}: {
  providers: OAuthProviderId[];
  oauthError?: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, fd) => await loginAction(prev, fd),
    {}
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>Track your investments</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <FieldContent>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <FieldContent>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </FieldContent>
          </Field>
          {state.error && <FieldError>{state.error}</FieldError>}
          {oauthError && <FieldError>{oauthError}</FieldError>}
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Signing in…" : "Sign in"}
          </Button>
          <p className="text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/register" className="underline underline-offset-4">
              Register
            </Link>
          </p>
          <OAuthSignInButtons providers={providers} />
        </CardFooter>
      </form>
    </Card>
  );
}
