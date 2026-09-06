import { and, eq, gte, sql } from "drizzle-orm";
import Decimal from "decimal.js";

import { db } from "@/lib/db";
import { assets, fxHistory, fxRates } from "@/lib/db/schema";
import { d, num } from "@/lib/utils/money";
import { dayKey } from "@/lib/utils/date";

const FX_TTL_MS = 12 * 60 * 60 * 1000; // 12h — daily rates are plenty
const FX_FETCH_TIMEOUT_MS = 3_000;
const rateRefreshes = new Map<string, Promise<Decimal>>();

export function isRateFresh(fetchedAt: Date, now = Date.now()): boolean {
  return now - fetchedAt.getTime() < FX_TTL_MS;
}

export async function getRate(from: string, to: string): Promise<Decimal> {
  if (from === to) return new Decimal(1);

  const pair = `${from}/${to}`;
  const [cached] = await db
    .select()
    .from(fxRates)
    .where(eq(fxRates.pair, pair))
    .limit(1);

  if (cached) {
    if (!isRateFresh(cached.fetchedAt)) {
      void refreshRate(from, to).catch(() => undefined);
    }
    return d(cached.rate);
  }

  return refreshRate(from, to);
}

async function refreshRate(from: string, to: string): Promise<Decimal> {
  const pair = `${from}/${to}`;
  const pending = rateRefreshes.get(pair);
  if (pending) return pending;

  const refresh = fetchAndStoreRate(from, to).finally(() => rateRefreshes.delete(pair));
  rateRefreshes.set(pair, refresh);
  return refresh;
}

async function fetchAndStoreRate(from: string, to: string): Promise<Decimal> {
  const pair = `${from}/${to}`;
  const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(FX_FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`FX fetch failed for ${pair}`);
  }
  const json = (await res.json()) as { rates?: Record<string, number> };
  const rate = json.rates?.[to];
  if (!rate) throw new Error(`No FX rate for ${pair}`);

  await db
    .insert(fxRates)
    .values({ pair, rate: String(rate), fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: fxRates.pair,
      set: { rate: String(rate), fetchedAt: new Date() },
    });

  return new Decimal(rate);
}

export async function convert(
  amount: string | number,
  from: string,
  to: string
): Promise<number> {
  if (amount === 0 || from === to) return num(amount);
  const rate = await getRate(from, to);
  return d(amount).mul(rate).toDecimalPlaces(2).toNumber();
}

/** Multiplier to express USD amounts in the user's base currency (1 if USD). */
export async function baseRate(baseCurrency: string): Promise<number> {
  return baseCurrency === "USD" ? 1 : (await getRate("USD", baseCurrency)).toNumber();
}

const FX_HISTORY_YEARS = 5;

/** Cur → USD daily rates from fx_history, keyed by day, for the given window. */
export async function loadFxHistory(
  currencies: string[],
  fromDay: string
): Promise<Map<string, Map<string, number>>> {
  const out: Map<string, Map<string, number>> = new Map();
  await Promise.all(
    currencies.filter((cur) => cur !== "USD").map(async (cur) => {
      const pair = `${cur}/USD`;
      const rows = await db
        .select()
        .from(fxHistory)
        .where(and(eq(fxHistory.pair, pair), gte(fxHistory.day, fromDay)));
      const m = new Map<string, number>();
      for (const r of rows) m.set(dayKey(new Date(r.day)), parseFloat(r.rate));
      if (m.size) out.set(cur, m);
    })
  );
  return out;
}

async function fetchFrankfurter(cur: string, fromYmd: string, toYmd: string) {
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/${fromYmd}..${toYmd}?base=${encodeURIComponent(cur)}&symbols=USD`,
      { cache: "no-store" }
    );
    if (!res.ok) return new Map<string, number>();
    const json = (await res.json()) as { rates?: Record<string, { USD?: number }> };
    const out = new Map<string, number>();
    for (const [day, r] of Object.entries(json.rates ?? {})) {
      if (r.USD != null) out.set(day, r.USD);
    }
    return out;
  } catch {
    return new Map<string, number>();
  }
}

/** Backfill daily CUR→USD rates (year chunks) for all non-USD asset currencies. */
export async function warmFxHistory(): Promise<void> {
  const rows = await db.select({ currency: assets.currency }).from(assets);
  const currencies = new Set(
    rows.map((r) => r.currency).filter((c): c is string => !!c && c !== "USD")
  );
  const end = dayKey(new Date());
  const startYear = new Date().getUTCFullYear() - FX_HISTORY_YEARS;

  for (const cur of currencies) {
    const pair = `${cur}/USD`;
    try {
      for (let y = startYear; y <= new Date().getUTCFullYear(); y++) {
        const fromYmd = `${y}-01-01`;
        const toYmd = `${y}-12-31`;
        const closes = await fetchFrankfurter(cur, fromYmd, toYmd);
        if (closes.size === 0) continue;
        const vals = [...closes.entries()]
          .filter(([day]) => day >= fromYmd && day <= end)
          .map(([day, rate]) => ({ pair, day, rate: String(rate) }));
        for (let i = 0; i < vals.length; i += 500) {
          await db
            .insert(fxHistory)
            .values(vals.slice(i, i + 500))
            .onConflictDoUpdate({
              target: [fxHistory.pair, fxHistory.day],
              set: { rate: sql`excluded.rate` },
            });
        }
      }

      // Ensure at least current rate is recorded if no history was available (non-ECB currencies)
      const [existing] = await db
        .select({ day: fxHistory.day })
        .from(fxHistory)
        .where(eq(fxHistory.pair, pair))
        .limit(1);
      if (!existing) {
        const spot = await getRate(cur, "USD").catch(() => null);
        if (spot) {
          await db
            .insert(fxHistory)
            .values({ pair, day: end, rate: spot.toString() })
            .onConflictDoNothing();
        }
      }
    } catch (e) {
      console.error(`[fx] warm ${cur} failed:`, e);
    }
  }
}
