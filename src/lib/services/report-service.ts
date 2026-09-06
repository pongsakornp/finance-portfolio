import Decimal from "decimal.js";

import { monthKey } from "@/lib/utils/date";
import { baseRate, getRate, loadFxHistory } from "@/lib/services/fx-service";
import type { TxRow } from "@/lib/services/view-service";

export type TxForReport = {
  assetId?: string;
  type: "buy" | "sell";
  quantity: string | number;
  price: string | number;
  fee: string | number;
  occurredAt: Date;
};

export type MonthlyRow = {
  month: string; // YYYY-MM
  invested: number;
  soldProceeds: number;
  realizedPL: number;
  fees: number;
};

/** Normalize native-currency transactions to USD so monthly aggregations are consistent. */
export async function toUsdReportTxs(txs: TxRow[]): Promise<TxForReport[]> {
  const out: TxForReport[] = [];
  const ratesCache = new Map<string, number>();
  for (const tx of txs) {
    if (tx.asset.currency === "USD") {
      out.push({
        assetId: tx.assetId,
        type: tx.type,
        quantity: tx.quantity,
        price: tx.price,
        fee: tx.fee,
        occurredAt: tx.occurredAt,
      });
      continue;
    }
    let r = ratesCache.get(tx.asset.currency);
    if (r === undefined) {
      r = (await getRate(tx.asset.currency, "USD")).toNumber();
      ratesCache.set(tx.asset.currency, r);
    }
    const q = parseFloat(String(tx.quantity));
    const p = parseFloat(String(tx.price));
    out.push({
      assetId: tx.assetId,
      type: tx.type,
      quantity: String(q),
      price: String(p * r),
      fee: String(parseFloat(String(tx.fee)) * r),
      occurredAt: tx.occurredAt,
    });
  }
  return out;
}

/** Normalize transaction amounts into the user's base currency using the transaction-day FX history. */
export async function toBaseReportTxs(txs: TxRow[], baseCurrency: string): Promise<TxForReport[]> {
  if (txs.length === 0) return [];
  const fromDay = txs.reduce(
    (earliest, tx) => (monthKey(tx.occurredAt) < earliest ? monthKey(tx.occurredAt) : earliest),
    monthKey(txs[0].occurredAt)
  ) + "-01";
  const currencies = new Set(txs.map((tx) => tx.asset.currency));
  if (baseCurrency !== "USD") currencies.add(baseCurrency);
  const history = await loadFxHistory([...currencies], fromDay);
  const currentToUsd = new Map<string, Decimal>();
  for (const currency of currencies) {
    if (currency !== "USD") currentToUsd.set(currency, await getRate(currency, "USD"));
  }
  const currentUsdToBase = baseCurrency === "USD" ? new Decimal(1) : new Decimal(await baseRate(baseCurrency));

  return txs.map((tx) => {
    const day = tx.occurredAt.toISOString().slice(0, 10);
    const nativeToUsd = tx.asset.currency === "USD"
      ? new Decimal(1)
      : new Decimal(history.get(tx.asset.currency)?.get(day) ?? currentToUsd.get(tx.asset.currency) ?? 1);
    const baseToUsd = baseCurrency === "USD" ? new Decimal(1) : new Decimal(history.get(baseCurrency)?.get(day) ?? 0);
    const usdToBase = baseToUsd.gt(0) ? new Decimal(1).div(baseToUsd) : currentUsdToBase;
    const factor = nativeToUsd.mul(usdToBase);
    return {
      assetId: tx.assetId,
      type: tx.type,
      quantity: tx.quantity,
      price: new Decimal(tx.price).mul(factor).toString(),
      fee: new Decimal(tx.fee).mul(factor).toString(),
      occurredAt: tx.occurredAt,
    };
  });
}

/** Pure monthly aggregation over transactions. Amounts in asset-native currency — caller converts or filters by currency first. */
export function monthlyBreakdown(txs: TxForReport[]): MonthlyRow[] {
  const sorted = [...txs].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
  );
  const map = new Map<string, MonthlyRow>();
  const positions = new Map<string, { qty: Decimal; cost: Decimal }>();

  for (const tx of sorted) {
    const month = monthKey(new Date(tx.occurredAt));
    const row =
      map.get(month) ??
      ({
        month,
        invested: 0,
        soldProceeds: 0,
        realizedPL: 0,
        fees: 0,
      } satisfies MonthlyRow);

    const qty = new Decimal(tx.quantity);
    const price = new Decimal(tx.price);
    const fee = new Decimal(tx.fee ?? 0);

    const assetKey = tx.assetId ?? "default";
    const pos = positions.get(assetKey) ?? { qty: new Decimal(0), cost: new Decimal(0) };

    if (tx.type === "buy") {
      row.invested += qty.mul(price).plus(fee).toNumber();
      row.fees += fee.toNumber();
      pos.qty = pos.qty.plus(qty);
      pos.cost = pos.cost.plus(qty.mul(price)).plus(fee);
    } else {
      row.soldProceeds += qty.mul(price).minus(fee).toNumber();
      row.fees += fee.toNumber();
      if (pos.qty.gt(0)) {
        const sellQty = Decimal.min(qty, pos.qty);
        const avg = pos.cost.div(pos.qty);
        const realized = sellQty.mul(price.minus(avg)).minus(fee);
        row.realizedPL += realized.toNumber();
        pos.cost = pos.cost.minus(avg.mul(sellQty));
        pos.qty = pos.qty.minus(sellQty);
        if (pos.qty.isZero()) pos.cost = new Decimal(0);
      }
    }
    positions.set(assetKey, pos);

    row.invested = Math.round(row.invested * 100) / 100;
    row.soldProceeds = Math.round(row.soldProceeds * 100) / 100;
    row.realizedPL = Math.round(row.realizedPL * 100) / 100;
    row.fees = Math.round(row.fees * 100) / 100;

    map.set(month, row);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}
