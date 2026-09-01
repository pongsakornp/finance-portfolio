import { and, eq, isNull } from "drizzle-orm";
import cron from "node-cron";

import { db } from "@/lib/db";
import { alerts, assets } from "@/lib/db/schema";
import { benchmarkSeries, warmAssetHistory } from "@/lib/services/valuation-service";
import { warmFxHistory } from "@/lib/services/fx-service";
import { backfillMutualFundNames, refreshFundCatalog } from "@/lib/services/fund-catalog-service";

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
      if (quote.price <= 0) continue;
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

/** Warm the S&P 500 benchmark cache (fills benchmark_cache). */
async function warmBenchmark() {
  try {
    await benchmarkSeries(3650);
  } catch (e) {
    console.error("[cron] benchmark warm failed:", e);
  }
}

export function startCron() {
  if (globalThis.__pfCronStarted) return; // dev hot-reload guard
  globalThis.__pfCronStarted = true;

  // nightly: backfill asset price history + daily FX so reads never fetch
  cron.schedule("5 0 * * *", () => {
    void warmHistory();
    void warmFx();
    void warmFunds();
  });
  // hourly: keep quote cache warm + evaluate alerts + fill benchmark cache
  cron.schedule("0 * * * *", () => {
    void checkAlerts();
    void warmBenchmark();
  });

  console.log("[cron] scheduled: history/FX nightly, alerts/benchmark hourly");
}

async function warmHistory() {
  try {
    await warmAssetHistory();
  } catch (e) {
    console.error("[cron] asset history warm failed:", e);
  }
}

async function warmFx() {
  try {
    await warmFxHistory();
  } catch (e) {
    console.error("[cron] FX history warm failed:", e);
  }
}

async function warmFunds() {
  try {
    await refreshFundCatalog();
    await backfillMutualFundNames();
  } catch (e) {
    console.error("[cron] fund catalog refresh failed:", e);
  }
}
