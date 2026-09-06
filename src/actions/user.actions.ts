"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/session";
import { setUserBaseCurrency, setUserPlView } from "@/lib/services/user-settings-service";
import { setBaseCurrencySchema, setPlViewSchema } from "@/lib/validators/alert.schema";

export async function setBaseCurrencyAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = setBaseCurrencySchema.safeParse({
    baseCurrency: formData.get("baseCurrency"),
  });
  if (!parsed.success) return { error: "Invalid currency" };

  await setUserBaseCurrency(userId, parsed.data.baseCurrency);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPlViewAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = setPlViewSchema.safeParse({
    plView: formData.get("plView"),
  });
  if (!parsed.success) return { error: "Invalid P/L view" };

  await setUserPlView(userId, parsed.data.plView);
  revalidatePath("/", "layout");
  return { ok: true };
}
