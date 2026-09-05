"use server";

import { searchStocks } from "@/lib/services/stock-search-service";

export type StockOption = { value: string; label: string };

export async function searchStocksAction(
  query: string,
  market: "US" | "SET",
  limit = 10
): Promise<StockOption[]> {
  const rows = await searchStocks(query, market, limit);
  return rows.map((row) => ({ value: row.symbol, label: row.nameEn }));
}
