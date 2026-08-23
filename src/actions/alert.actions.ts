"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { alerts } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { createAlertSchema } from "@/lib/validators/alert.schema";

import { upsertAsset } from "./transaction.actions";

export async function createAlertAction(formData: FormData) {
  const userId = await requireUserId();
  const parsed = createAlertSchema.safeParse({
    symbol: formData.get("symbol"),
    assetType: formData.get("assetType"),
    direction: formData.get("direction"),
    threshold: formData.get("threshold"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  try {
    const assetId = await upsertAsset({
      symbol: d.symbol,
      name: "",
      type: d.assetType,
      currency: d.assetType === "crypto" ? "USD" : undefined,
    });
    await db.insert(alerts).values({
      userId,
      assetId,
      direction: d.direction,
      threshold: String(d.threshold),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to create alert" };
  }
  revalidatePath("/alerts");
  return { ok: true };
}

export async function deleteAlertAction(id: string) {
  const userId = await requireUserId();
  await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
  revalidatePath("/alerts");
  return { ok: true };
}

export async function toggleAlertActive(id: string, active: boolean) {
  const userId = await requireUserId();
  // re-arming an alert clears its trigger stamp
  await db
    .update(alerts)
    .set({ active, triggeredAt: active ? null : undefined })
    .where(and(eq(alerts.id, id), eq(alerts.userId, userId)));
  revalidatePath("/alerts");
  return { ok: true };
}
