"use client";

import Link from "next/link";
import { useActionState } from "react";

import { registerAction, type FormState } from "@/actions/auth.actions";
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

export function RegisterForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    async (prev, fd) => await registerAction(prev, fd),
    {}
  );

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Create account</CardTitle>
        <CardDescription>Start tracking your portfolio</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <FieldContent>
              <Input id="name" name="name" required maxLength={60} />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <FieldContent>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </FieldContent>
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <FieldContent>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </FieldContent>
          </Field>
          {state.error && <FieldError>{state.error}</FieldError>}
        </CardContent>
        <CardFooter className="mt-6 flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating…" : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already registered?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
