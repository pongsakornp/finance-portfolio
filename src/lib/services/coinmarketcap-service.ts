const CMC_API_URL = "https://pro-api.coinmarketcap.com";

type CmcUsdQuote = {
  symbol?: string;
  price?: number;
  percent_change_24h?: number | null;
};

type CmcLatestAsset = {
  id?: number;
  quote?: CmcUsdQuote[] | { USD?: CmcUsdQuote };
};

type CmcLatestResponse = { data?: CmcLatestAsset[] | Record<string, CmcLatestAsset> };

type CmcHistoricalPoint = {
  timestamp?: string;
  quote?: { USD?: CmcUsdQuote };
};

type CmcHistoricalResponse = {
  data?: Record<string, { quotes?: CmcHistoricalPoint[] }>;
};

export type CryptoQuote = {
  price: number;
  previousClose: number | null;
  currency: "USD";
};

export type CryptoHistoryPoint = { timestamp: string; price: number };
export type CryptoCatalogEntry = { cmcId: string; symbol: string; name: string };

function apiKey(): string {
  const key = process.env.COINMARKETCAP_API_KEY;
  if (!key) throw new Error("COINMARKETCAP_API_KEY is not configured");
  return key;
}

async function cmcFetch(path: string, params: URLSearchParams): Promise<Response> {
  const res = await fetch(`${CMC_API_URL}${path}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
      "X-CMC_PRO_API_KEY": apiKey(),
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`CoinMarketCap ${path}: HTTP ${res.status}`);
  return res;
}

function usdQuote(quote: CmcLatestAsset["quote"]): CmcUsdQuote | undefined {
  if (Array.isArray(quote)) return quote.find((entry) => entry.symbol === "USD");
  return quote?.USD;
}

function previousClose(price: number, change: number | null | undefined): number | null {
  if (change == null || !Number.isFinite(change)) return null;
  return change === -100 ? 0 : price / (1 + change / 100);
}

/** Latest USD quote for a stable CoinMarketCap cryptocurrency ID. */
export async function fetchCoinMarketCapQuote(id: string): Promise<CryptoQuote> {
  const params = new URLSearchParams({ id, convert: "USD" });
  const json = (await (await cmcFetch("/v3/cryptocurrency/quotes/latest", params)).json()) as CmcLatestResponse;
  const entry = Array.isArray(json.data) ? json.data[0] : json.data?.[id];
  const quote = entry && usdQuote(entry.quote);
  const price = quote?.price;
  if (!Number.isFinite(price) || price == null || price <= 0) {
    throw new Error(`CoinMarketCap ${id}: no USD price`);
  }
  return {
    price,
    previousClose: previousClose(price, quote?.percent_change_24h),
    currency: "USD",
  };
}

/** Five-year daily USD quote history for a stable CoinMarketCap cryptocurrency ID. */
export async function fetchCoinMarketCapHistory(id: string, years: number): Promise<CryptoHistoryPoint[]> {
  const start = new Date();
  start.setUTCFullYear(start.getUTCFullYear() - years);
  start.setUTCHours(23, 59, 0, 0);
  const params = new URLSearchParams({
    id,
    convert: "USD",
    interval: "24h",
    time_start: start.toISOString(),
    time_end: new Date().toISOString(),
  });
  const json = (await (await cmcFetch("/v3/cryptocurrency/quotes/historical", params)).json()) as CmcHistoricalResponse;
  const points = json.data?.[id]?.quotes ?? [];
  return points.flatMap((point) => {
    const price = point.quote?.USD?.price;
    return point.timestamp && Number.isFinite(price) && price! > 0
      ? [{ timestamp: point.timestamp, price: price! }]
      : [];
  });
}

/** Complete active-asset ID map, paginated at CoinMarketCap's maximum page size. */
export async function fetchCoinMarketCapCatalog(): Promise<CryptoCatalogEntry[]> {
  const entries: CryptoCatalogEntry[] = [];
  const pageSize = 5_000;

  for (let start = 1; ; start += pageSize) {
    const params = new URLSearchParams({
      listing_status: "active",
      sort: "id",
      start: String(start),
      limit: String(pageSize),
    });
    const json = (await (await cmcFetch("/v1/cryptocurrency/map", params)).json()) as {
      data?: Array<{ id?: number; symbol?: string; name?: string }>;
    };
    const page = (json.data ?? []).flatMap((asset) =>
      asset.id != null && asset.symbol && asset.name
        ? [{ cmcId: String(asset.id), symbol: asset.symbol, name: asset.name }]
        : []
    );
    entries.push(...page);
    if ((json.data ?? []).length < pageSize) break;
  }

  return entries;
}
