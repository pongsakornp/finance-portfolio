import { and, eq, isNull } from "drizzle-orm";
import cron from "node-cron";

import { db } from "@/lib/db";
import { alerts, assets, portfolios, snapshots } from "@/lib/db/schema";
import {
  buildHoldingsView,
  getUserTransactions,
} from "@/lib/services/view-service";
import { dayKey } from "@/lib/utils/date";

async function takeSnapshots() {
  const all = await db.select({ id: portfolios.id }).from(portfolios);
  const today = dayKey(new Date());
  for (const p of all) {
    try {
      const txs = await getUserTransactions(undefined, p.id);
      const view = await buildHoldingsView(txs);
      await db
        .insert(snapshots)
        .values({
          portfolioId: p.id,
          day: today,
          valueUsd: String(view.totalsUsd.marketValue),
          costUsd: String(view.totalsUsd.costBasis),
        })
        .onConflictDoUpdate({
          target: [snapshots.portfolioId, snapshots.day],
          set: {
            valueUsd: String(view.totalsUsd.marketValue),
            costUsd: String(view.totalsUsd.costBasis),
          },
        });
    } catch (e) {
      console.error(`[cron] snapshot failed for portfolio ${p.id}:`, e);
    }
  }
}

/** Refresh quote cache via alert checks and mark hit alerts as triggered. */
async function checkAlerts() {
  const rows = await db
    .select({ alert: alerts, asset: assets })
    .from(alerts)
    .innerJoin(assets, eq(assets.id, alerts.assetId))
    .where(and(eq(alerts.active, true), isNull(alerts.triggeredAt)));

  const { getQuote } = await import("@/lib/services/quote-service");

  for (const { alert, asset } of rows) {
    try {
      const quote = await getQuote(asset); // side effect: refreshes cache
      const threshold = parseFloat(alert.threshold);
      const hit =
        alert.direction === "above"
          ? quote.price >= threshold
          : quote.price <= threshold;
      if (hit) {
        await db
          .update(alerts)
          .set({ triggeredAt: new Date() })
          .where(eq(alerts.id, alert.id));
      }
    } catch (e) {
      console.error(`[cron] alert ${alert.id} check failed:`, e);
    }
  }
}

declare global {  var __pfCronStarted: boolean | undefined;
}

export function startCron() {
  if (globalThis.__pfCronStarted) return; // dev hot-reload guard
  globalThis.__pfCronStarted = true;

  // nightly portfolio snapshot, just after UTC midnight
  cron.schedule("5 0 * * *", () => void takeSnapshots());
  // hourly: keep quote cache warm + evaluate alerts
  cron.schedule("0 * * * *", () => void checkAlerts());

  console.log("[cron] scheduled: snapshots @00:05 UTC, alerts hourly");
}
