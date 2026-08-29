/**
 * CoinGecko uses canonical lowercase IDs ("bitcoin"), not tickers ("BTC").
 * When no explicit externalId is stored, we map common tickers so quotes
 * don't silently 404 (and crash the dashboard). Unknown tickers resolve to
 * null and the caller falls back to a best-guess / graceful skip.
 */
export const COINGECKO_BY_SYMBOL: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  ADA: "cardano",
  DOT: "polkadot",
  XRP: "ripple",
  XLM: "stellar",
  ALGO: "algorand",
  HBAR: "hedera-hashgraph",
  SOL: "solana",
  DOGE: "dogecoin",
  LTC: "litecoin",
  LINK: "chainlink",
  UNI: "uniswap",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  POL: "polygon-ecosystem-token",
  ATOM: "cosmos",
  XTZ: "tezos",
  EOS: "eos",
  TRX: "tron",
  BNB: "binancecoin",
  XMR: "monero",
  NEAR: "near",
  ICP: "internet-computer",
  FIL: "filecoin",
  SHIB: "shiba-inu",
  PEPE: "pepe",
  APT: "aptos",
  SUI: "sui",
};

/** Resolve a CoinGecko id, preferring an explicit stored externalId. */
export function resolveCoinId(symbol: string, externalId?: string | null): string | null {
  if (externalId) return externalId;
  return COINGECKO_BY_SYMBOL[symbol.toUpperCase()] ?? null;
}
