import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { alerts, assets } from "@/lib/db/schema";
import { upsertAsset } from "@/lib/services/transaction-service";
import type { CreateAlertInput } from "@/lib/validators/alert.schema";

export type CreateAlertServiceInput = CreateAlertInput & { externalId?: string };

export async function createAlert(userId: string, input: CreateAlertServiceInput) {
  if (input.assetType === "crypto" && !/^[1-9]\d*$/.test(input.externalId ?? "")) {
    throw new Error("CoinMarketCap ID is required for crypto alerts");
  }
  const assetId = await upsertAsset({
    symbol: input.symbol,
    name: "",
    type: input.assetType,
    currency: input.assetType === "crypto" ? "USD" : undefined,
    market: input.market ?? (input.symbol.endsWith(".BK") ? "SET" : "US"),
    externalId: input.externalId,
  });
  const [created] = await db
    .insert(alerts)
    .values({ userId, assetId, direction: input.direction, threshold: String(input.threshold) })
    .returning({ id: alerts.id });
  return created;
}

export async function listAlerts(userId: string) {
  const rows = await db
    .select({ alert: alerts, asset: assets })
    .from(alerts)
    .innerJoin(assets, eq(assets.id, alerts.assetId))
    .where(eq(alerts.userId, userId));
  return rows.map(({ alert, asset }) => ({
    id: alert.id,
    symbol: asset.symbol,
    assetType: asset.type,
    currency: asset.currency,
    direction: alert.direction,
    threshold: parseFloat(alert.threshold),
    active: alert.active,
    triggeredAt: alert.triggeredAt?.toISOString() ?? null,
  }));
}

export async function deleteAlert(alertId: string, userId: string) {
  const [deleted] = await db
    .delete(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .returning({ id: alerts.id });
  if (!deleted) throw new Error("Alert not found");
}

export async function setAlertActive(alertId: string, userId: string, active: boolean) {
  const [updated] = await db
    .update(alerts)
    .set(active ? { active: true, triggeredAt: null } : { active: false })
    .where(and(eq(alerts.id, alertId), eq(alerts.userId, userId)))
    .returning({ id: alerts.id });
  if (!updated) throw new Error("Alert not found");
}
