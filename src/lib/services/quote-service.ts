import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { assets, priceCache } from "@/lib/db/schema";

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

type YahooChart = {
  chart: {
    result?: Array<{
      meta: {
        regularMarketPrice: number;
        chartPreviousClose?: number;
        previousClose?: number;
        currency: string;
      };
    }>;
    error?: unknown;
  };
};

async function fetchYahoo(symbol: string): Promise<{ price: number; previousClose: number | null; currency: string }> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`,
    { headers: { "User-Agent": "Mozilla/5.0 (portfolio-tracker)" }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = (await res.json()) as YahooChart;
  const meta = json.chart.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) throw new Error(`Yahoo ${symbol}: no price`);
  return {
    price: meta.regularMarketPrice,
    previousClose: meta.previousClose ?? meta.chartPreviousClose ?? null,
    currency: meta.currency === "GBp" ? "GBX" : (meta.currency ?? "USD"),
  };
}

async function fetchCoinGecko(id: string): Promise<{ price: number; previousClose: number | null; currency: string }> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd&include_24hr_change=true`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`CoinGecko ${id}: HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
  const entry = json[id];
  if (!entry?.usd) throw new Error(`CoinGecko ${id}: no price`);
  return {
    price: entry.usd,
    previousClose: entry.usd_24h_change
      ? entry.usd / (1 + entry.usd_24h_change / 100)
      : null,
    currency: "USD",
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
async function fetchFinnomena(symbol: string): Promise<{ price: number; previousClose: number | null; currency: string }> {
  const to = Math.floor(Date.now() / 1000) + 86400;
  const from = to - 14 * 86400;
  const res = await fetch(
    `https://www.finnomena.com/fn3/api/fund/v2/public/tv/history?symbol=${encodeURIComponent(symbol)}&resolution=1D&from=${from}&to=${to}`,
    { cache: "no-store" }
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

function ttlFor(type: Asset["type"]): number {
  // crypto trades 24/7 → refresh faster than market-hours assets
  // mutual fund NAV updates once daily after market close → 6h is plenty
  if (type === "crypto") return 60_000;
  if (type === "mutualfund") return 6 * 60 * 60_000;
  return 5 * 60_000;
}

/** Quote with DB-backed TTL cache. All pages go through this — never call Yahoo/CoinGecko directly. */
export async function getQuote(asset: Asset): Promise<Quote> {
  const base = { assetId: asset.id, symbol: asset.symbol, name: asset.name, type: asset.type };

  // cash has no market price — always worth exactly 1 of its own currency
  if (asset.type === "cash") {
    return { ...base, currency: asset.currency, price: 1, previousClose: null };
  }

  const [cached] = await db
    .select()
    .from(priceCache)
    .where(inArray(priceCache.assetId, [asset.id]))
    .limit(1);

  if (cached && Date.now() - cached.fetchedAt.getTime() < ttlFor(asset.type)) {
    return {
      ...base,
      currency: cached.currency,
      price: parseFloat(cached.price),
      previousClose: cached.previousClose ? parseFloat(cached.previousClose) : null,
    };
  }

  try {
    const fresh =
      asset.type === "crypto"
        ? await fetchCoinGecko(asset.externalId ?? asset.symbol.toLowerCase())
        : asset.type === "mutualfund"
          ? await fetchFinnomena(asset.symbol)
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

    return {
      ...base,
      currency: fresh.currency,
      price: fresh.price,
      previousClose: fresh.previousClose,
    };
  } catch {
    if (cached) {
      // stale fallback beats a hard failure on flaky free APIs
      return {
        ...base,
        currency: cached.currency,
        price: parseFloat(cached.price),
        previousClose: cached.previousClose ? parseFloat(cached.previousClose) : null,
      };
    }
    throw new Error(`No quote available for ${asset.symbol}`);
  }
}
