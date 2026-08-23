"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { setBaseCurrencySchema } from "@/lib/validators/alert.schema";

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
