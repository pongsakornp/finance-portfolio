"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { signIn, signOut } from "@/lib/auth";
import { AuthError } from "next-auth";

const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type FormState = { error?: string };

export async function registerAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const email = parsed.data.email.toLowerCase();

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing) return { error: "Email already registered" };

  await db.insert(users).values({
    email,
    name: parsed.data.name,
    passwordHash: await bcrypt.hash(parsed.data.password, 10),
  });

  try {
    await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Sign-in failed after registration" };
    throw error;
  }
  return {};
}

export async function loginAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "Invalid email or password" };

  try {
    await signIn("credentials", {
      ...parsed.data,
      email: parsed.data.email.toLowerCase(),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) return { error: "Invalid email or password" };
    throw error;
  }
  return {};
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

