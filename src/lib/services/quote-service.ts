import { inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { assets, priceCache } from "@/lib/db/schema";

export type Asset = typeof assets.$inferSelect;

export type Quote = {
  assetId: string;
  symbol: string;
  name: string;
  type: "stock" | "etf" | "crypto";
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

function ttlFor(type: Asset["type"]): number {
  // crypto trades 24/7 → refresh faster than market-hours assets
  return type === "crypto" ? 60_000 : 5 * 60_000;
}

/** Quote with DB-backed TTL cache. All pages go through this — never call Yahoo/CoinGecko directly. */
export async function getQuote(asset: Asset): Promise<Quote> {
  const base = { assetId: asset.id, symbol: asset.symbol, name: asset.name, type: asset.type };

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
