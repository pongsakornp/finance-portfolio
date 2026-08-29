import { eq } from "drizzle-orm";
import Decimal from "decimal.js";

import { db } from "@/lib/db";
import { fxRates } from "@/lib/db/schema";
import { d, num } from "@/lib/utils/money";

const FX_TTL_MS = 12 * 60 * 60 * 1000; // 12h — daily rates are plenty

export async function getRate(from: string, to: string): Promise<Decimal> {
  if (from === to) return new Decimal(1);

  const pair = `${from}/${to}`;
  const [cached] = await db
    .select()
    .from(fxRates)
    .where(eq(fxRates.pair, pair))
    .limit(1);

  if (cached && Date.now() - cached.fetchedAt.getTime() < FX_TTL_MS) {
    return d(cached.rate);
  }

  const res = await fetch(`https://open.er-api.com/v6/latest/${from}`, {
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    if (cached) return d(cached.rate); // stale is better than nothing
    throw new Error(`FX fetch failed for ${pair}`);
  }
  const json = (await res.json()) as { rates?: Record<string, number> };
  const rate = json.rates?.[to];
  if (!rate) throw new Error(`No FX rate for ${pair}`);

  await db
    .insert(fxRates)
    .values({ pair, rate: String(rate), fetchedAt: new Date() })
    .onConflictDoUpdate({
      target: fxRates.pair,
      set: { rate: String(rate), fetchedAt: new Date() },
    });

  return new Decimal(rate);
}

export async function convert(
  amount: string | number,
  from: string,
  to: string
): Promise<number> {
  if (amount === 0 || from === to) return num(amount);
  const rate = await getRate(from, to);
  return d(amount).mul(rate).toDecimalPlaces(2).toNumber();
}

/** Multiplier to express USD amounts in the user's base currency (1 if USD). */
export async function baseRate(baseCurrency: string): Promise<number> {
  return baseCurrency === "USD" ? 1 : (await getRate("USD", baseCurrency)).toNumber();
}
