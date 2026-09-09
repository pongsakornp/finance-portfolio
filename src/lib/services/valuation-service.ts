import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import Decimal from "decimal.js";

import { db } from "@/lib/db";
import { assets, benchmarkCache, priceHistory } from "@/lib/db/schema";
import type { Asset } from "@/lib/services/quote-service";
import { setYahooSymbol } from "@/lib/services/quote-service";
import { fetchCoinMarketCapHistory } from "@/lib/services/coinmarketcap-service";
import { baseRate, getRate, loadFxHistory } from "@/lib/services/fx-service";
import { dayKey } from "@/lib/utils/date";

const HISTORY_YEARS = 5;
const HISTORY_FRESHNESS_DAYS = 3;
const HISTORY_FETCH_TIMEOUT_MS = 5_000;

// Coalesce concurrent chart requests for the same asset. Without this, opening
// or navigating between pages while a history backfill is running can start the
// same multi-year upstream download and DB upsert more than once.
const historyBackfills = new Map<string, Promise<void>>();

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
    signal: AbortSignal.timeout(HISTORY_FETCH_TIMEOUT_MS),
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

async function coinMarketCapHistory(id: string): Promise<Map<string, number>> {
  const points = await fetchCoinMarketCapHistory(id, HISTORY_YEARS);
  const out = new Map<string, number>();
  points.forEach(({ timestamp, price }) => out.set(dayKey(new Date(timestamp)), price));
  return out;
}

/** Thai mutual fund NAV history from Finnomena's public API. */
async function finnomenaHistory(symbol: string): Promise<Map<string, number>> {
  const to = Math.floor(Date.now() / 1000) + 86400;
  const from = to - (HISTORY_YEARS * 366 + 1) * 86400;
  const res = await fetch(
    `https://www.finnomena.com/fn3/api/fund/v2/public/tv/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${to}`,
    { cache: "no-store", signal: AbortSignal.timeout(HISTORY_FETCH_TIMEOUT_MS) }
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

/** SET listed share/ETF daily closes via Finnomena's public tradingview feed. Bare symbol. */
async function finnomenaStockHistory(symbol: string): Promise<Map<string, number>> {
  const res = await fetch(
    `https://www.finnomena.com/market-info/api/tradingview/TH/trade/${encodeURIComponent(symbol)}?period=MAX`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(HISTORY_FETCH_TIMEOUT_MS),
    }
  );
  if (!res.ok) throw new Error(`Finnomena history ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as { t?: number[]; c?: Array<string | number> };
  const out = new Map<string, number>();
  json.t?.forEach((ts, i) => {
    const close = json.c?.[i];
    if (close != null) out.set(dayKey(new Date(ts * 1000)), parseFloat(String(close)));
  });
  return out;
}

export function isHistoryFresh(latestDay: string | undefined, cutoff: string): boolean {
  return latestDay !== undefined && latestDay >= cutoff;
}

/** Backfills daily closes into price_history when stale (>3 days). */
async function ensureHistoryUnshared(asset: Asset): Promise<void> {
  const cutoff = new Date(
    Date.now() - HISTORY_FRESHNESS_DAYS * 86400_000
  ).toISOString().slice(0, 10);
  const [historical] = await db
    .select({ day: priceHistory.day })
    .from(priceHistory)
    .where(and(eq(priceHistory.assetId, asset.id), eq(priceHistory.source, 1)))
    .orderBy(desc(priceHistory.day))
    .limit(1);
  if (isHistoryFresh(historical?.day, cutoff)) return; // official close history already backfilled

  try {
    const closes =
      asset.type === "crypto"
        ? asset.externalId
          ? await coinMarketCapHistory(asset.externalId)
          : new Map<string, number>()
        : asset.type === "mutualfund"
          ? await finnomenaHistory(asset.symbol)
          : asset.market === "SET"
            ? await finnomenaStockHistory(asset.symbol.replace(/\.BK$/, "")).catch(() =>
                yahooHistory(setYahooSymbol(asset.symbol))
              )
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

async function ensureHistory(asset: Asset): Promise<void> {
  const pending = historyBackfills.get(asset.id);
  if (pending) return pending;

  const backfill = ensureHistoryUnshared(asset).finally(() => {
    historyBackfills.delete(asset.id);
  });
  historyBackfills.set(asset.id, backfill);
  return backfill;
}

/** Daily backfill of price history for every asset (cron). */
export async function warmAssetHistory(): Promise<void> {
  const all = await db.select({ asset: assets }).from(assets);
  for (const { asset } of all) {
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
  type: "buy" | "sell";
  quantity: string;
  price: string;
  fee: string;
  occurredAt: Date;
  asset: Asset;
};

export type SeriesContext = {
  distinctAssets: Asset[];
  txsAsc: TxWithAsset[];
  windowStart: string;
  closeMaps: Map<string, Map<string, number>>;
  fxByDay: Map<string, Map<string, number>>;
  usdRates: Map<string, number>;
  timeline: string[];
};

export type DayState = {
  day: string;
  positions: Map<string, { qty: Decimal; cost: Decimal }>;
  lastClose: Map<string, Decimal>;
};

/** Shared setup: asset history backfill, closes, FX, and the chronological timeline. */
async function buildSeriesContext(
  txs: TxWithAsset[],
  days: number
): Promise<SeriesContext | null> {
  if (txs.length === 0) return null;

  const distinctAssets = [...new Map(txs.map((t) => [t.asset.id, t.asset])).values()];
  const firstTxDay = dayKey(new Date(Math.min(...txs.map((t) => t.occurredAt.getTime()))));
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

  const txsAsc = [...txs].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const daysUnion = new Set<string>();
  closeMaps.forEach((m) => m.forEach((_, d) => d >= fromDay && daysUnion.add(d)));
  const timeline = [...daysUnion].sort();
  if (timeline.length === 0) return null;

  return { distinctAssets, txsAsc, windowStart, closeMaps, fxByDay, usdRates, timeline };
}

/**
 * Walks the timeline applying avg-cost semantics (same rules as computePosition in
 * holdings-service) and yields per-day positions + last-known close for every asset.
 */
export function* walkSeries(ctx: SeriesContext): Generator<DayState> {
  const positions = new Map<string, { qty: Decimal; cost: Decimal }>();
  const lastClose = new Map<string, Decimal>();
  let ti = 0;
  for (const day of ctx.timeline) {
    while (
      ti < ctx.txsAsc.length &&
      dayKey(new Date(ctx.txsAsc[ti].occurredAt.getTime())) <= day
    ) {
      const t = ctx.txsAsc[ti++];
      const position = positions.get(t.asset.id) ?? { qty: new Decimal(0), cost: new Decimal(0) };
      const q = new Decimal(t.quantity);
      if (t.type === "buy") {
        position.qty = position.qty.plus(q);
        position.cost = position.cost
          .plus(q.mul(new Decimal(t.price)))
          .plus(new Decimal(t.fee ?? 0));
      } else if (position.qty.gt(0)) {
        const sold = Decimal.min(q, position.qty);
        position.cost = position.cost.minus(position.cost.div(position.qty).mul(sold));
        position.qty = position.qty.minus(sold);
        if (position.qty.isZero()) position.cost = new Decimal(0);
      }
      positions.set(t.asset.id, position);
    }
    for (const a of ctx.distinctAssets) {
      const rawClose = ctx.closeMaps.get(a.id)?.get(day);
      if (rawClose != null) lastClose.set(a.id, new Decimal(rawClose));
    }
    yield { day, positions, lastClose };
  }
}

/** Per-day FX multiplier (1 for USD), falling back to today's rate on a missing day. */
function dayFx(ctx: SeriesContext, day: string, currency: string): Decimal {
  return currency === "USD"
    ? new Decimal(1)
    : new Decimal(ctx.fxByDay.get(currency)?.get(day) ?? ctx.usdRates.get(currency) ?? 1);
}

/**
 * Reconstructs the portfolio's daily USD value by walking transactions forward
 * through each asset's historical closes. Non-USD assets use per-day FX (falls
 * back to today's rate for a missing day).
 */
export async function portfolioSeries(
  txs: TxWithAsset[],
  days: number
): Promise<SeriesPoint[]> {
  const ctx = await buildSeriesContext(txs, days);
  if (!ctx) return [];

  const points: SeriesPoint[] = [];
  for (const { day, positions, lastClose } of walkSeries(ctx)) {
    let dayValue = new Decimal(0);
    for (const a of ctx.distinctAssets) {
      const qty = positions.get(a.id)?.qty ?? new Decimal(0);
      const lc = lastClose.get(a.id);
      if (lc != null && qty.gt(0)) {
        dayValue = dayValue.plus(qty.mul(lc).mul(dayFx(ctx, day, a.currency)));
      }
    }
    points.push({ day, value: dayValue.toDecimalPlaces(2).toNumber() });
  }

  // drop leading zero-value days (before the first position) so %-normalization
  // has a sane base instead of collapsing to 1 and exploding the percentages
  const firstNonZero = points.findIndex((p) => p.value > 0);
  const series = firstNonZero === -1 ? [] : points.slice(firstNonZero);

  return series.filter((p) => p.day >= ctx.windowStart);
}

/**
 * Daily unrealized P/L in USD, using the same average-cost rules as holdings.
 * Cost basis is converted at each day's FX rate so the final point matches the
 * portfolio's current display calculation.
 */
export async function unrealizedPlSeries(
  txs: TxWithAsset[],
  days: number
): Promise<SeriesPoint[]> {
  const ctx = await buildSeriesContext(txs, days);
  if (!ctx) return [];

  const points: Array<SeriesPoint & { started: boolean }> = [];
  for (const { day, positions, lastClose } of walkSeries(ctx)) {
    let unrealized = new Decimal(0);
    let started = false;
    for (const a of ctx.distinctAssets) {
      const position = positions.get(a.id);
      const last = lastClose.get(a.id);
      if (!position || !last || position.qty.lte(0)) continue;
      started = true;
      unrealized = unrealized.plus(
        position.qty.mul(last).minus(position.cost).mul(dayFx(ctx, day, a.currency))
      );
    }
    points.push({ day, value: unrealized.toDecimalPlaces(2).toNumber(), started });
  }

  const firstStarted = points.findIndex((point) => point.started);
  return (firstStarted === -1 ? [] : points.slice(firstStarted))
    .filter((point) => point.day >= ctx.windowStart)
    .map(({ day, value }) => ({ day, value }));
}

/** Converts USD historical values into the user's base currency using daily FX. */
export async function convertUsdSeries(
  points: SeriesPoint[],
  baseCurrency: string
): Promise<SeriesPoint[]> {
  if (baseCurrency === "USD" || points.length === 0) return points;
  const current = await baseRate(baseCurrency);
  const history = await loadFxHistory([baseCurrency], points[0].day);
  const baseToUsd = history.get(baseCurrency);
  return points.map((point) => {
    const rate = baseToUsd?.get(point.day);
    const usdToBase = rate && rate > 0 ? 1 / rate : current;
    return { day: point.day, value: Math.round(point.value * usdToBase * 100) / 100 };
  });
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
