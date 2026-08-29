"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { setBaseCurrencySchema, setPlViewSchema } from "@/lib/validators/alert.schema";

export async function setBaseCurrencyAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = setBaseCurrencySchema.safeParse({
    baseCurrency: formData.get("baseCurrency"),
  });
  if (!parsed.success) return { error: "Invalid currency" };

  await db
    .update(users)
    .set({ baseCurrency: parsed.data.baseCurrency })
    .where(eq(users.id, userId));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPlViewAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = setPlViewSchema.safeParse({
    plView: formData.get("plView"),
  });
  if (!parsed.success) return { error: "Invalid P/L view" };

  await db
    .update(users)
    .set({ plView: parsed.data.plView })
    .where(eq(users.id, userId));
  revalidatePath("/", "layout");
  return { ok: true };
}
