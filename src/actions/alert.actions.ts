"use server";

import { revalidatePath } from "next/cache";

import { requireUserId } from "@/lib/session";
import { createAlertSchema } from "@/lib/validators/alert.schema";
import { createAlert, deleteAlert, setAlertActive } from "@/lib/services/alert-service";

export async function createAlertAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = createAlertSchema.safeParse({
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    market: (formData.get("market") as "US" | "SET") || undefined,
    direction: formData.get("direction"),
    threshold: formData.get("threshold"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  try {
    await createAlert(userId, d);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create alert" };
  }
  revalidatePath("/alerts");
  return { ok: true };
}

export async function deleteAlertAction(id: string) {
  const userId = await requireUserId();
  await deleteAlert(id, userId);
  revalidatePath("/alerts");
  return { ok: true };
}

export async function toggleAlertActive(id: string, active: boolean) {
  const userId = await requireUserId();
  await setAlertActive(id, userId, active);
  revalidatePath("/alerts");
  return { ok: true };
}
