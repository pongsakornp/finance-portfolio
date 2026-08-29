import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import Decimal from "decimal.js";

import { db } from "@/lib/db";
import { assets, benchmarkCache, priceHistory } from "@/lib/db/schema";
import type { Asset } from "@/lib/services/quote-service";
import { getRate, loadFxHistory } from "@/lib/services/fx-service";
import { dayKey } from "@/lib/utils/date";

const HISTORY_YEARS = 5;

export type SeriesPoint = { day: string; value: number };

type YahooHistory = {
  chart: {
    result?: Array<{
      timestamp?: number[];
      indicators?: { quote?: Array<{ close?: (number | null)[] }> };
    }>;
  };
};

async function yahooHistory(symbol: string): Promise<Map<string, number>> {
  return yahooChart(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${HISTORY_YEARS}y`
  );
}

async function yahooChart(url: string): Promise<Map<string, number>> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (portfolio-tracker)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Yahoo history: HTTP ${res.status}`);
  const json = (await res.json()) as YahooHistory;
  const r = json.chart.result?.[0];
  const out = new Map<string, number>();
  r?.timestamp?.forEach((ts, i) => {
    const close = r.indicators?.quote?.[0]?.close?.[i];
    if (close != null) out.set(dayKey(new Date(ts * 1000)), close);
  });
  return out;
}

async function coingeckoHistory(id: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${HISTORY_YEARS * 365}&interval=daily`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`CoinGecko history ${id}: HTTP ${res.status}`);
  const json = (await res.json()) as { prices?: [number, number][] };
  const out = new Map<string, number>();
  json.prices?.forEach(([ms, price]) => out.set(dayKey(new Date(ms)), price));
  return out;
}

/** Thai mutual fund NAV history from Finnomena's public API. */
async function finnomenaHistory(symbol: string): Promise<Map<string, number>> {
  const to = Math.floor(Date.now() / 1000) + 86400;
  const from = to - (HISTORY_YEARS * 366 + 1) * 86400;
  const res = await fetch(
    `https://www.finnomena.com/fn3/api/fund/v2/public/tv/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${to}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Finnomena history ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as { s: string; t?: number[]; c?: number[] };
  const out = new Map<string, number>();
  if (json.s === "ok") {
    json.t?.forEach((ts, i) => {
      const close = json.c?.[i];
      if (close != null) out.set(dayKey(new Date(ts * 1000)), close);
    });
  }
  return out;
}

/** Backfills daily closes into price_history when stale (>3 days). */
async function ensureHistory(asset: Asset): Promise<void> {
  // cash never moves — nothing to fetch
  if (asset.type === "cash") return;
  const cutoff = new Date(Date.now() - 3 * 86400_000).toISOString().slice(0, 10);
  const [latest] = await db
    .select({ day: priceHistory.day })
    .from(priceHistory)
    .where(eq(priceHistory.assetId, asset.id))
    .orderBy(desc(priceHistory.day))
    .limit(1);
  if (latest && latest.day >= cutoff) return;

  try {
    const closes =
      asset.type === "crypto"
        ? await coingeckoHistory(asset.externalId ?? asset.symbol.toLowerCase())
        : asset.type === "mutualfund"
          ? await finnomenaHistory(asset.symbol)
          : await yahooHistory(asset.symbol);
    if (closes.size === 0) return;
    const rows = [...closes.entries()].map(([day, close]) => ({
      assetId: asset.id,
      day,
      close: String(close),
    }));
    // batch upsert, 500 rows/chunk keeps postgres parameter limits safe;
    // overwrite so an official daily close replaces the live (source=2) row
    for (let i = 0; i < rows.length; i += 500) {
      await db
        .insert(priceHistory)
        .values(rows.slice(i, i + 500))
        .onConflictDoUpdate({
          target: [priceHistory.assetId, priceHistory.day],
          set: { close: sql`excluded.close`, source: 1 },
        });
    }
  } catch {
    // free API hiccup — series degrades gracefully below
  }
}

/** Daily backfill of price history for every non-cash asset (cron). */
export async function warmAssetHistory(): Promise<void> {
  const all = await db.select({ asset: assets }).from(assets);
  for (const { asset } of all) {
    if (asset.type === "cash") continue;
    try {
      await ensureHistory(asset);
    } catch {
      // skip unhealthy assets; retried next run
    }
  }
}

async function loadCloses(
  assetId: string,
  fromDay: string
): Promise<Map<string, number>> {
  const rows = await db
    .select({ day: priceHistory.day, close: priceHistory.close })
    .from(priceHistory)
    .where(and(eq(priceHistory.assetId, assetId), gte(priceHistory.day, fromDay)));
  const m = new Map<string, number>();
  rows.forEach((r) => m.set(r.day, parseFloat(r.close)));
  return m;
}

export type TxWithAsset = {
  type: "buy" | "sell" | "dividend";
  quantity: string;
  price: string;
  fee: string;
  occurredAt: Date;
  asset: Asset;
};

/**
 * Reconstructs the portfolio's daily USD value by walking transactions forward
 * through each asset's historical closes. Non-USD assets use per-day FX (falls
 * back to today's rate for a missing day).
 */
export async function portfolioSeries(
  txs: TxWithAsset[],
  days: number
): Promise<SeriesPoint[]> {
  if (txs.length === 0) return [];

  const distinctAssets = [...new Map(txs.map((t) => [t.asset.id, t.asset])).values()];
  const firstTxDay = dayKey(
    new Date(Math.min(...txs.map((t) => t.occurredAt.getTime())))
  );
  const windowStart = dayKey(new Date(Date.now() - (days - 1) * 86400_000));
  const fromDay = firstTxDay < windowStart ? firstTxDay : windowStart;

  await Promise.all(distinctAssets.map(ensureHistory));
  const closeMaps = new Map<string, Map<string, number>>();
  await Promise.all(
    distinctAssets.map(async (a) => closeMaps.set(a.id, await loadCloses(a.id, fromDay)))
  );

  const usdRates = new Map<string, number>();
  const nonUsd = new Set<string>();
  for (const cur of new Set(distinctAssets.map((a) => a.currency))) {
    if (cur !== "USD") nonUsd.add(cur);
  }
  await Promise.all(
    [...nonUsd].map(async (cur) => usdRates.set(cur, (await getRate(cur, "USD")).toNumber()))
  );
  // per-day FX so multi-currency historical valuation isn't pinned to today's rate
  const fxByDay = await loadFxHistory([...nonUsd], fromDay);

  // chronological transaction buckets
  const txsAsc = [...txs].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const daysUnion = new Set<string>();
  closeMaps.forEach((m) => m.forEach((_, d) => d >= fromDay && daysUnion.add(d)));
  const timeline = [...daysUnion].sort();
  if (timeline.length === 0) {
    // cash-only portfolio: no price history anywhere — synthesize a plain daily timeline
    if (!distinctAssets.some((a) => a.type === "cash")) return [];
    const end = Date.now();
    for (let t = new Date(fromDay + "T00:00:00Z").getTime(); t <= end; t += 86400_000)
      timeline.push(dayKey(new Date(t)));
    if (timeline.length === 0) return [];
  }

  const holdings = new Map<string, Decimal>();
  let ti = 0;
  const points: SeriesPoint[] = [];
  const lastClose = new Map<string, Decimal>();

  for (const day of timeline) {
    while (
      ti < txsAsc.length &&
      dayKey(new Date(txsAsc[ti].occurredAt.getTime())) <= day
    ) {
      const t = txsAsc[ti++];
      const prevQty = holdings.get(t.asset.id) ?? new Decimal(0);
      const q = new Decimal(t.quantity);
      if (t.type === "buy") {
        holdings.set(t.asset.id, prevQty.plus(q));
      } else if (t.type === "sell") {
        holdings.set(t.asset.id, Decimal.max(0, prevQty.minus(q)));
      }
    }
    let dayValue = new Decimal(0);
    for (const a of distinctAssets) {
      // cash has no history rows — constant price 1 in its own currency
      const rawClose =
        closeMaps.get(a.id)?.get(day) ?? (a.type === "cash" ? 1 : undefined);
      if (rawClose != null) lastClose.set(a.id, new Decimal(rawClose));
      const lc = lastClose.get(a.id);
      const qty = holdings.get(a.id) ?? new Decimal(0);
      if (lc != null && qty.gt(0)) {
        const cur = a.currency;
        const perDay =
          cur === "USD"
            ? new Decimal(1)
            : new Decimal(fxByDay.get(cur)?.get(day) ?? usdRates.get(cur) ?? 1);
        dayValue = dayValue.plus(qty.mul(lc).mul(perDay));
      }
    }
    points.push({ day, value: dayValue.toDecimalPlaces(2).toNumber() });
  }

  // drop leading zero-value days (before the first position) so %-normalization
  // has a sane base instead of collapsing to 1 and exploding the percentages
  const firstNonZero = points.findIndex((p) => p.value > 0);
  const series = firstNonZero === -1 ? [] : points.slice(firstNonZero);

  return series.filter((p) => p.day >= windowStart);
}

const BENCHMARK_INDEX = "%5EGSPC";
const BENCHMARK_TTL_MS = 24 * 60 * 60 * 1000; // index updates daily

/** ^GSPC closes cached in benchmark_cache with a stale fallback + query2 retry. */
async function loadBenchmark(windowStart: string): Promise<Map<string, number>> {
  const cached = await db
    .select()
    .from(benchmarkCache)
    .where(and(eq(benchmarkCache.index, BENCHMARK_INDEX), gte(benchmarkCache.day, windowStart)))
    .orderBy(asc(benchmarkCache.day));
  const cachedMap = new Map<string, number>(
    cached.map((r) => [dayKey(new Date(r.day)), parseFloat(r.close)])
  );

  const last = cached[cached.length - 1];
  const fresh =
    !!last &&
    Date.now() - new Date(`${last.day}T00:00:00Z`).getTime() < BENCHMARK_TTL_MS;
  if (fresh && cachedMap.size > 0) return cachedMap;

  // fetch fresh, trying both Yahoo hosts before giving up
  let closes: Map<string, number> | null = null;
  for (const host of ["query1", "query2"]) {
    try {
      const got = await yahooChart(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${BENCHMARK_INDEX}?interval=1d&range=1y`
      );
      if (got.size > 0) {
        closes = got;
        break;
      }
    } catch {
      /* try next host */
    }
  }

  if (closes && closes.size > 0) {
    // upsert every close so the cache stays warm
    const values = [...closes.entries()].map(([day, close]) => ({
      index: BENCHMARK_INDEX,
      day,
      close: String(close),
    }));
    for (const v of values) {
      await db
        .insert(benchmarkCache)
        .values(v)
        .onConflictDoUpdate({
          target: [benchmarkCache.index, benchmarkCache.day],
          set: { close: v.close },
        });
    }
    return new Map([...cachedMap, ...closes]);
  }

  // final fallback: stale cache beats nothing
  if (cachedMap.size > 0) return cachedMap;
  return new Map();
}

/** S&P 500 index closes, normalized to pct-change vs first point. */
export async function benchmarkSeries(days: number): Promise<SeriesPoint[]> {
  try {
    const windowStart = dayKey(new Date(Date.now() - (days - 1) * 86400_000));
    const closes = await loadBenchmark(windowStart);
    return [...closes.entries()]
      .filter(([day]) => day >= windowStart)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, close]) => ({ day, value: Math.round(close * 100) / 100 }));
  } catch {
    return [];
  }
}
