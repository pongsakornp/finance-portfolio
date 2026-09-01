import { eq, ilike, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { assets, fundCatalog } from "@/lib/db/schema";

type FundRow = { shortCode: string; name: string };

async function fetchFunds(): Promise<FundRow[]> {
  const res = await fetch(
    "https://www.finnomena.com/fn3/api/fund/v2/public/funds",
    { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (portfolio-tracker)" }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Finnomena funds: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: Array<{ short_code?: string; name_th?: string }>;
  };
  return (json.data ?? [])
    .filter((f) => f.short_code && f.name_th)
    .map((f) => ({ shortCode: f.short_code!, name: f.name_th! }));
}

/** Sync the fund_catalog master list from Finnomena, upserting short_code → name. */
export async function refreshFundCatalog(): Promise<void> {
  const rows = await fetchFunds();
  for (const f of rows) {
    await db
      .insert(fundCatalog)
      .values({ shortCode: f.shortCode, name: f.name })
      .onConflictDoUpdate({ target: fundCatalog.shortCode, set: { name: f.name, updatedAt: new Date() } });
  }
}

/** Backfill existing mutual-fund assets whose name is still the symbol. */
export async function backfillMutualFundNames(): Promise<void> {
  const [mutuals, catalog] = await Promise.all([
    db.select().from(assets).where(eq(assets.type, "mutualfund")),
    db.select().from(fundCatalog),
  ]);
  const byCode = new Map(catalog.map((c) => [c.shortCode, c.name]));
  for (const a of mutuals) {
    const name = byCode.get(a.symbol);
    if (name && a.name === a.symbol) {
      await db.update(assets).set({ name }).where(eq(assets.id, a.id));
    }
  }
}

/** Best-effort fund name lookup for a single symbol (DB only, no network). */
export async function getFundName(shortCode: string): Promise<string | null> {
  const [row] = await db
    .select({ name: fundCatalog.name })
    .from(fundCatalog)
    .where(eq(fundCatalog.shortCode, shortCode))
    .limit(1);
  return row?.name ?? null;
}

/** Search funds by code or name, for the symbol autocomplete. */
export async function searchFundCatalog(q: string, limit = 10): Promise<FundRow[]> {
  const term = `%${q.trim()}%`;
  const rows = await db
    .select({ shortCode: fundCatalog.shortCode, name: fundCatalog.name })
    .from(fundCatalog)
    .where(or(ilike(fundCatalog.shortCode, term), ilike(fundCatalog.name, term)))
    .orderBy(fundCatalog.shortCode)
    .limit(limit);
  return rows.map((r) => ({ shortCode: r.shortCode, name: r.name }));
}

export async function listFundSymbols(limit = 500): Promise<FundRow[]> {
  const rows = await db
    .select({ shortCode: fundCatalog.shortCode, name: fundCatalog.name })
    .from(fundCatalog)
    .orderBy(fundCatalog.shortCode)
    .limit(limit);
  return rows.map((r) => ({ shortCode: r.shortCode, name: r.name }));
}
