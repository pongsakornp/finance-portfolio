"use server";

import { listFundSymbols, searchFundCatalog } from "@/lib/services/fund-catalog-service";

export type FundOption = { value: string; label: string };

export async function searchFundsAction(query: string, limit = 10): Promise<FundOption[]> {
  const rows = query.trim()
    ? await searchFundCatalog(query, limit)
    : await listFundSymbols(limit);
  return rows.map((r) => ({ value: r.shortCode, label: r.name }));
}
