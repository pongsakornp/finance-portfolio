import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { assets, priceCache, priceHistory } from "@/lib/db/schema";
import { fetchCoinMarketCapQuote } from "@/lib/services/coinmarketcap-service";
import { upsertAsset } from "@/lib/services/transaction-service";
import { dayKey } from "@/lib/utils/date";

const QUOTE_FETCH_TIMEOUT_MS = 3_000;
const quoteRefreshes = new Map<string, Promise<Quote>>();

export type Asset = typeof assets.$inferSelect;

export type Quote = {
  assetId: string;
  symbol: string;
  name: string;
  type: "stock" | "etf" | "crypto" | "commodity" | "cash" | "mutualfund";
  currency: string;
  price: number;
  previousClose: number | null;
};

export type QuoteRequest = {
  symbol: string;
  assetType: Exclude<Asset["type"], "cash">;
  assetMarket: "US" | "SET";
  externalId?: string;
};

type FetchResult = {
  price: number;
  previousClose: number | null;
  currency: string;
  name?: string | null;
  nameEn?: string | null;
  nameTh?: string | null;
};

type YahooChart = {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency: string;
        longName?: string;
        shortName?: string;
      };
    }>;
    error?: unknown;
  };
};

async function fetchYahoo(symbol: string): Promise<FetchResult> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    {
      headers: { "User-Agent": "Mozilla/5.0 (portfolio-tracker)" },
      cache: "no-store",
      signal: AbortSignal.timeout(QUOTE_FETCH_TIMEOUT_MS),
    }
  );
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as YahooChart;
  const meta = json.chart.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`Yahoo ${symbol}: no price`);
  const name = meta.longName ?? meta.shortName ?? null;
  return {
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
    currency: meta.currency === "GBp" ? "GBX" : (meta.currency ?? "USD"),
    name,
    nameEn: name,
  };
}

type FinnomenaHistory = {
  s: string;
  t?: number[];
  c?: number[];
};

/**
 * Thai mutual fund NAV via Finnomena's public (unofficial) TradingView-style API.
 * NAV updates once daily EOD — price = latest close, previousClose = prior day.
 * ponytail: undocumented endpoint, may change without notice; stale-cache fallback covers outages.
 */
async function fetchFinnomena(symbol: string): Promise<FetchResult> {
  const to = Math.floor(Date.now() / 1000) + 86400;
  const from = to - 14 * 86400;
  const res = await fetch(
    `https://www.finnomena.com/fn3/api/fund/v2/public/tv/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${to}`,
    { cache: "no-store", signal: AbortSignal.timeout(QUOTE_FETCH_TIMEOUT_MS) }
  );
  if (!res.ok) throw new Error(`Finnomena ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as FinnomenaHistory;
  const closes = json.c ?? [];
  if (json.s !== "ok" || closes.length === 0) {
    throw new Error(`Finnomena ${symbol}: no NAV`);
  }
  const last = closes[closes.length - 1];
  const prev = closes.length > 1 ? closes[closes.length - 2] : null;
  return { price: last, previousClose: prev, currency: "THB" };
}

/**
 * Yahoo symbol for a SET-listed security: strip a `.BK` suffix, re-append it.
 * Accepts both `ASK` and `ASK.BK` → `ASK.BK`.
 */
export function setYahooSymbol(symbol: string): string {
  return `${symbol.replace(/\.BK$/, "")}.BK`;
}

type FinnomenaStock = {
  status?: boolean;
  data?: {
    name?: string;
    th_name?: string;
    price?: string | number;
    currency?: string;
    perf_1d?: string | number | null;
    perf_p_1d?: string | number | null;
  };
};

/**
 * SET (Thai) listed share/ETF quote from Finnomena's public market-info API.
 * Bare symbol (no `.BK`). `price` + `perf_1d` (day change) derive previousClose.
 * ponytail: undocumented endpoint, may change without notice; Yahoo fallback + stale cache cover outages.
 */
async function fetchFinnomenaStock(symbol: string): Promise<FetchResult> {
  const res = await fetch(
    `https://www.finnomena.com/market-info/api/public/stock/quote/${encodeURIComponent(symbol)}`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(QUOTE_FETCH_TIMEOUT_MS),
    }
  );
  if (!res.ok) throw new Error(`Finnomena ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as FinnomenaStock;
  const price = json.data?.price != null ? parseFloat(String(json.data.price)) : NaN;
  if (!Number.isFinite(price)) throw new Error(`Finnomena ${symbol}: no price`);
  const perf1d = json.data?.perf_1d != null ? parseFloat(String(json.data.perf_1d)) : null;
  const perfP1d = json.data?.perf_p_1d != null ? parseFloat(String(json.data.perf_p_1d)) : null;
  const previousClose =
    perf1d != null && Number.isFinite(perf1d)
      ? price - perf1d
      : perfP1d != null && Number.isFinite(perfP1d) && perfP1d !== -100
        ? price / (1 + perfP1d / 100)
        : null;
  return {
    price,
    previousClose,
    currency: json.data?.currency ?? "THB",
    name: json.data?.th_name || json.data?.name || null,
    nameEn: json.data?.name ?? null,
    nameTh: json.data?.th_name ?? null,
  };
}

/**
 * SET (Thai) listed shares/ETFs: Finnomena's share feed first, Yahoo `.BK` fallback.
 * Open-end Thai mutual funds (no exchange listing) are priced separately via
 * Finnomena — that path lives in the `mutualfund` branch, not here. Both return THB.
 */
async function fetchSet(symbol: string): Promise<FetchResult> {
  const bare = symbol.replace(/\.BK$/, "");
  return fetchFinnomenaStock(bare).catch(() => fetchYahoo(setYahooSymbol(symbol)));
}

/** Day key to append to the daily series, or null to skip (weekend for market-hours assets). */
export function quoteSeriesDay(type: Asset["type"], now = new Date()): string | null {
  if (type === "crypto") return dayKey(now);
  return [0, 6].includes(now.getUTCDay()) ? null : dayKey(now);
}

function ttlFor(type: Asset["type"]): number {
  // crypto trades 24/7 → refresh faster than market-hours assets
  // mutual fund NAV updates once daily after market close → 6h is plenty
  if (type === "crypto") return 60_000;
  if (type === "mutualfund") return 6 * 60 * 60_000;
  return 5 * 60_000;
}

export function isQuoteFresh(
  type: Asset["type"],
  fetchedAt: Date,
  now = Date.now()
): boolean {
  return now - fetchedAt.getTime() < ttlFor(type);
}

function quoteFromCache(asset: Asset, cached: typeof priceCache.$inferSelect): Quote {
  const base = { assetId: asset.id, symbol: asset.symbol, name: asset.name, type: asset.type };
  return {
    ...base,
    currency: cached.currency,
    price: parseFloat(cached.price),
    previousClose: cached.previousClose ? parseFloat(cached.previousClose) : null,
  };
}

async function refreshQuote(asset: Asset): Promise<Quote> {
  const pending = quoteRefreshes.get(asset.id);
  if (pending) return pending;

  const refresh = fetchAndStoreQuote(asset).finally(() => quoteRefreshes.delete(asset.id));
  quoteRefreshes.set(asset.id, refresh);
  return refresh;
}

async function fetchAndStoreQuote(asset: Asset): Promise<Quote> {
  const base = { assetId: asset.id, symbol: asset.symbol, name: asset.name, type: asset.type };
  try {
    const fresh =
      asset.type === "crypto"
        ? asset.externalId
          ? await fetchCoinMarketCapQuote(asset.externalId)
          : (() => {
              throw new Error(`CoinMarketCap ID is required for ${asset.symbol}`);
            })()
        : asset.type === "mutualfund"
          ? await fetchFinnomena(asset.symbol)
          : asset.market === "SET"
            ? await fetchSet(asset.symbol)
            : await fetchYahoo(asset.symbol);

    await db
      .insert(priceCache)
      .values({
        assetId: asset.id,
        price: String(fresh.price),
        previousClose: fresh.previousClose !== null ? String(fresh.previousClose) : null,
        currency: fresh.currency,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: priceCache.assetId,
        set: {
          price: String(fresh.price),
          previousClose:
            fresh.previousClose !== null ? String(fresh.previousClose) : null,
          currency: fresh.currency,
          fetchedAt: new Date(),
        },
      });

    // Keep the daily series current. Live/intraday price → source=2 (official
    // close from ensureHistory overwrites it next day). Skip weekend rows for
    // market-hours assets to avoid spurious points.
    const seriesDay = quoteSeriesDay(asset.type);
    if (seriesDay) {
      await db
        .insert(priceHistory)
        .values({
          assetId: asset.id,
          day: seriesDay,
          close: String(fresh.price),
          source: 2,
        })
        .onConflictDoNothing();
    }

    // Fill a name still stuck at its symbol (no name input for stock/ETF/crypto)
    // and preserve both localized names when a provider supplies them.
    let resolvedName = asset.name;
    if (asset.name === asset.symbol && fresh.name) {
      // Yahoo appends the market suffix for crypto (e.g. "Bitcoin USD") — drop it.
      resolvedName =
        asset.type === "crypto" && fresh.name.endsWith(" USD")
          ? fresh.name.slice(0, -4)
          : fresh.name;
    }
    const nameEn = asset.nameEn ?? fresh.nameEn ?? null;
    const nameTh = asset.nameTh ?? fresh.nameTh ?? null;
    if (resolvedName !== asset.name || nameEn !== asset.nameEn || nameTh !== asset.nameTh) {
      await db
        .update(assets)
        .set({ name: resolvedName, nameEn, nameTh })
        .where(eq(assets.id, asset.id));
    }

    return {
      ...base,
      name: resolvedName,
      currency: fresh.currency,
      price: fresh.price,
      previousClose: fresh.previousClose,
    };
  } catch {
    throw new Error(`No quote available for ${asset.symbol}`);
  }
}

/**
 * Quote with a DB-backed TTL cache. Expired values render immediately while a
 * deduplicated refresh runs in the background, keeping page navigation off the
 * critical path for slow market-data providers.
 */
export async function getQuote(asset: Asset): Promise<Quote> {
  const [cached] = await db
    .select()
    .from(priceCache)
    .where(inArray(priceCache.assetId, [asset.id]))
    .limit(1);

  if (cached) {
    if (!isQuoteFresh(asset.type, cached.fetchedAt)) {
      void refreshQuote(asset).catch(() => undefined);
    }
    return quoteFromCache(asset, cached);
  }

  return refreshQuote(asset);
}

/** Resolve an asset symbol through the shared asset registry before quoting it. */
export async function getQuoteForRequest(request: QuoteRequest): Promise<{ quote: Quote; assetCreated: boolean }> {
  const symbol = request.symbol.trim().toUpperCase();
  if (request.assetType === "crypto" && !/^[1-9]\d*$/.test(request.externalId ?? "")) {
    throw new Error(`CoinMarketCap ID is required for ${symbol}`);
  }
  let [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.symbol, symbol), eq(assets.type, request.assetType)))
    .limit(1);
  const assetCreated = !asset;
  if (!asset) {
    const id = await upsertAsset({
      symbol,
      name: symbol,
      type: request.assetType,
      market: request.assetMarket,
      externalId: request.externalId,
    });
    [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  }
  if (!asset) throw new Error(`Unknown asset ${symbol}`);
  return { quote: await getQuote(asset), assetCreated };
}
