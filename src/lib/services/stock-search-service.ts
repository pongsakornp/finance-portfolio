export type StockSearchOption = {
  symbol: string;
  nameEn: string;
};

type YahooSearchResponse = {
  quotes?: Array<{
    exchange?: string;
    quoteType?: string;
    symbol?: string;
    longname?: string;
    shortname?: string;
  }>;
};

const US_EXCHANGES = new Set(["ASE", "BTS", "NCM", "NGM", "NMS", "NYQ", "OQB", "PNK"]);

/**
 * Search Yahoo Finance's instrument index for US or SET securities. SET
 * symbols arrive with Yahoo's `.BK` suffix but are stored bare; quote-service
 * adds the suffix only when calling Yahoo.
 * ponytail: Yahoo's search endpoint is undocumented; a manual symbol entry
 * remains available if it is unavailable.
 */
export async function searchStocks(
  query: string,
  market: "US" | "SET",
  limit = 10
): Promise<StockSearchOption[]> {
  const term = query.trim();
  if (!term) return [];
  const yahooTerm = market === "SET" && !/\.BK$/i.test(term) ? `${term}.BK` : term;

  const res = await fetch(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(yahooTerm)}&quotesCount=${Math.min(Math.max(limit * 3, 10), 50)}&newsCount=0`,
    { headers: { "User-Agent": "Mozilla/5.0 (portfolio-tracker)" }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Yahoo search: HTTP ${res.status}`);

  const json = (await res.json()) as YahooSearchResponse;
  const seen = new Set<string>();
  return (json.quotes ?? []).flatMap((quote) => {
    const symbol = quote.symbol?.trim();
    const isSecurity = quote.quoteType === "EQUITY" || quote.quoteType === "ETF";
    const matchesMarket =
      market === "SET"
        ? quote.exchange === "SET" || symbol?.endsWith(".BK")
        : quote.exchange != null && US_EXCHANGES.has(quote.exchange);
    if (!symbol || !isSecurity || !matchesMarket) return [];

    const normalizedSymbol = market === "SET" ? symbol.replace(/\.BK$/i, "") : symbol;
    if (seen.has(normalizedSymbol)) return [];
    seen.add(normalizedSymbol);
    return [{ symbol: normalizedSymbol, nameEn: quote.longname ?? quote.shortname ?? normalizedSymbol }];
  }).slice(0, limit);
}
