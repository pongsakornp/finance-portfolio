export type CommoditySearchOption = {
  symbol: string;
  name: string;
};

type YahooSearchResponse = {
  quotes?: Array<{
    quoteType?: string;
    symbol?: string;
    longname?: string;
    shortname?: string;
  }>;
};

/**
 * Search Yahoo's commodity futures index. Futures symbols are compatible with
 * quote-service's Yahoo chart lookup; free-form entry remains available when
 * the undocumented Yahoo search endpoint has no result.
 */
export async function searchCommodities(
  query: string,
  limit = 10
): Promise<CommoditySearchOption[]> {
  const term = query.trim();
  if (!term) return [];

  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(term)}&quotesCount=${Math.min(Math.max(limit * 3, 10), 50)}&newsCount=0`,
    { headers: { "User-Agent": "Mozilla/5.0 (portfolio-tracker)" }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Yahoo search: HTTP ${res.status}`);

  const seen = new Set<string>();
  const json = (await res.json()) as YahooSearchResponse;
  return (json.quotes ?? []).flatMap((quote) => {
    const symbol = quote.symbol?.trim();
    if (!symbol || quote.quoteType !== "FUTURE" || seen.has(symbol)) return [];
    seen.add(symbol);
    return [{ symbol, name: quote.longname ?? quote.shortname ?? symbol }];
  }).slice(0, limit);
}
