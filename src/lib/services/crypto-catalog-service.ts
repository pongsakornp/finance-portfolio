import { count, ilike, lt, or, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { cryptoCatalog } from "@/lib/db/schema";
import { fetchCoinMarketCapCatalog } from "@/lib/services/coinmarketcap-service";

export type CryptoCatalogRow = { cmcId: string; symbol: string; name: string };

let initialRefresh: Promise<void> | undefined;

/** Sync active CoinMarketCap assets so typeahead never calls the provider per keystroke. */
export async function refreshCryptoCatalog(): Promise<void> {
  const rows = await fetchCoinMarketCapCatalog();
  const refreshStarted = new Date();
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    await db
      .insert(cryptoCatalog)
      .values(batch)
      .onConflictDoUpdate({
        target: cryptoCatalog.cmcId,
        set: {
          symbol: sql`excluded.symbol`,
          name: sql`excluded.name`,
          updatedAt: refreshStarted,
        },
      });
  }
  await db.delete(cryptoCatalog).where(lt(cryptoCatalog.updatedAt, refreshStarted));
}

async function ensureCryptoCatalog(): Promise<void> {
  const [row] = await db.select({ total: count() }).from(cryptoCatalog);
  if (Number(row?.total ?? 0) > 0) return;
  initialRefresh ??= refreshCryptoCatalog().finally(() => {
    initialRefresh = undefined;
  });
  await initialRefresh;
}

/** Search the local CoinMarketCap catalog by ticker or name. */
export async function searchCryptoCatalog(query: string, limit = 10): Promise<CryptoCatalogRow[]> {
  await ensureCryptoCatalog();
  const term = `%${query.trim()}%`;
  const rows = await db
    .select({ cmcId: cryptoCatalog.cmcId, symbol: cryptoCatalog.symbol, name: cryptoCatalog.name })
    .from(cryptoCatalog)
    .where(or(ilike(cryptoCatalog.symbol, term), ilike(cryptoCatalog.name, term)))
    .orderBy(cryptoCatalog.symbol)
    .limit(limit);
  return rows;
}
