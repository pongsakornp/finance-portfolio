"use server";

import { searchCryptoCatalog } from "@/lib/services/crypto-catalog-service";

export type CryptoOption = { value: string; label: string; cmcId: string };

export async function searchCryptoAssetsAction(query: string, limit = 10): Promise<CryptoOption[]> {
  const rows = await searchCryptoCatalog(query, limit);
  return rows.map((row) => ({ value: row.symbol, label: row.name, cmcId: row.cmcId }));
}
