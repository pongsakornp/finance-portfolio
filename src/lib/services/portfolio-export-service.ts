import Decimal from "decimal.js";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getRate } from "@/lib/services/fx-service";
import { computePosition } from "@/lib/services/holdings-service";
import { getQuote } from "@/lib/services/quote-service";
import {
  getUserPortfolios,
  getUserTransactions,
  type TxRow,
} from "@/lib/services/view-service";

type PortfolioRef = { id: string; name: string };

type SnapshotHolding = {
  symbol: string;
  name: string;
  assetType: string;
  nativeCurrency: string;
  quantity: number;
  averageCost: number;
  costBasis: number;
  currentPrice: number | null;
  previousClose: number | null;
  valuationStatus: "priced" | "unavailable";
  marketValue: number | null;
  unrealizedPL: number | null;
  unrealizedPLPct: number | null;
  realizedPL: number | null;
  dayChange: number | null;
  dayChangePct: number | null;
  firstBuyAt: string;
};

export type PortfolioHoldingsSnapshot = {
  portfolio: PortfolioRef;
  exportedAt: string;
  baseCurrency: string;
  totals: {
    marketValue: number;
    costBasis: number;
    unrealizedPL: number;
    unrealizedPLPct: number;
    realizedPL: number;
    dayChange: number;
    dayChangePct: number;
    valuedHoldingCount: number;
    unpricedHoldingCount: number;
  };
  holdings: SnapshotHolding[];
};

const roundMoney = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2).toNumber();
const roundPercent = (value: Decimal.Value) => new Decimal(value).toDecimalPlaces(2).toNumber();

/**
 * Produces a point-in-time, base-currency holdings report. An unavailable quote
 * never removes an open position from the export; its live valuation is null.
 */
export async function buildPortfolioHoldingsSnapshot(
  txs: TxRow[],
  portfolio: PortfolioRef,
  baseCurrency: string,
  exportedAt = new Date()
): Promise<PortfolioHoldingsSnapshot> {
  const byAsset = new Map<string, TxRow[]>();
  for (const tx of txs) {
    const list = byAsset.get(tx.asset.id) ?? [];
    list.push(tx);
    byAsset.set(tx.asset.id, list);
  }

  const usdToBase =
    baseCurrency === "USD"
      ? new Decimal(1)
      : await getRate("USD", baseCurrency);

  const holdings: SnapshotHolding[] = [];
  let marketValue = new Decimal(0);
  let costBasis = new Decimal(0);
  let unrealizedPL = new Decimal(0);
  let realizedPL = new Decimal(0);
  let dayChange = new Decimal(0);
  let valuedHoldingCount = 0;
  let unpricedHoldingCount = 0;

  for (const list of byAsset.values()) {
    const sorted = [...list].sort(
      (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime()
    );
    const asset = sorted[0].asset;
    const quote = await getQuote(asset).catch(() => null);
    const position = computePosition(sorted, quote?.price);
    if (position.qty <= 0) continue;

    const nativeToUsd =
      asset.currency === "USD"
        ? new Decimal(1)
        : await getRate(asset.currency, "USD").catch(() => null);
    const nativeToBase = nativeToUsd?.mul(usdToBase) ?? null;
    const priced = quote !== null && nativeToBase !== null;

    if (!priced) {
      unpricedHoldingCount += 1;
      holdings.push({
        symbol: asset.symbol,
        name: asset.name,
        assetType: asset.type,
        nativeCurrency: asset.currency,
        quantity: position.qty,
        averageCost: position.avgCost,
        costBasis: position.costBasis,
        currentPrice: null,
        previousClose: null,
        valuationStatus: "unavailable",
        marketValue: null,
        unrealizedPL: null,
        unrealizedPLPct: null,
        realizedPL: null,
        dayChange: null,
        dayChangePct: null,
        firstBuyAt: sorted[0].occurredAt.toISOString(),
      });
      continue;
    }

    const value = new Decimal(position.marketValue).mul(nativeToBase);
    const cost = new Decimal(position.costBasis).mul(nativeToBase);
    const unrealized = value.minus(cost);
    const realized = new Decimal(position.realizedPL).mul(nativeToBase);
    const daily = quote.previousClose === null
      ? null
      : new Decimal(quote.price).minus(quote.previousClose).mul(position.qty).mul(nativeToBase);

    marketValue = marketValue.plus(value);
    costBasis = costBasis.plus(cost);
    unrealizedPL = unrealizedPL.plus(unrealized);
    realizedPL = realizedPL.plus(realized);
    if (daily) dayChange = dayChange.plus(daily);
    valuedHoldingCount += 1;

    holdings.push({
      symbol: asset.symbol,
      name: asset.name,
      assetType: asset.type,
      nativeCurrency: asset.currency,
      quantity: position.qty,
      averageCost: position.avgCost,
      costBasis: position.costBasis,
      currentPrice: quote.price,
      previousClose: quote.previousClose,
      valuationStatus: "priced",
      marketValue: roundMoney(value),
      unrealizedPL: roundMoney(unrealized),
      unrealizedPLPct: position.costBasis > 0 ? roundPercent(position.unrealizedPLPct) : 0,
      realizedPL: roundMoney(realized),
      dayChange: daily === null ? null : roundMoney(daily),
      dayChangePct:
        quote.previousClose !== null && quote.previousClose > 0
          ? roundPercent(new Decimal(quote.price).minus(quote.previousClose).div(quote.previousClose).mul(100))
          : null,
      firstBuyAt: sorted[0].occurredAt.toISOString(),
    });
  }

  const previousMarketValue = marketValue.minus(dayChange);
  return {
    portfolio,
    exportedAt: exportedAt.toISOString(),
    baseCurrency,
    totals: {
      marketValue: roundMoney(marketValue),
      costBasis: roundMoney(costBasis),
      unrealizedPL: roundMoney(unrealizedPL),
      unrealizedPLPct: costBasis.gt(0) ? roundPercent(unrealizedPL.div(costBasis).mul(100)) : 0,
      realizedPL: roundMoney(realizedPL),
      dayChange: roundMoney(dayChange),
      dayChangePct: previousMarketValue.gt(0) ? roundPercent(dayChange.div(previousMarketValue).mul(100)) : 0,
      valuedHoldingCount,
      unpricedHoldingCount,
    },
    holdings,
  };
}

/** Loads the owned portfolio and its user preference before building an export. */
export async function getPortfolioHoldingsSnapshot(
  userId: string,
  portfolioId: string
): Promise<PortfolioHoldingsSnapshot> {
  const [portfolios, userRows] = await Promise.all([
    getUserPortfolios(userId),
    db.select({ baseCurrency: users.baseCurrency }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  const portfolio = portfolios.find((item) => item.id === portfolioId);
  if (!portfolio) throw new Error("Portfolio not found");

  const txs = await getUserTransactions(userId, portfolioId);
  return buildPortfolioHoldingsSnapshot(txs, portfolio, userRows[0]?.baseCurrency ?? "USD");
}
