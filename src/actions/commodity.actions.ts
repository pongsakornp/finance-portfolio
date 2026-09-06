"use server";

import { searchCommodities } from "@/lib/services/commodity-search-service";

export type CommodityOption = { value: string; label: string };

export async function searchCommoditiesAction(
  query: string,
  limit = 10
): Promise<CommodityOption[]> {
  const rows = await searchCommodities(query, limit);
  return rows.map((row) => ({ value: row.symbol, label: row.name }));
}
