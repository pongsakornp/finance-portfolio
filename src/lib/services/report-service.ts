import Decimal from "decimal.js";

import { monthKey } from "@/lib/utils/date";
import { getRate } from "@/lib/services/fx-service";
import type { TxRow } from "@/lib/services/view-service";

export type TxForReport = {
  assetId?: string;
  type: "buy" | "sell" | "dividend";
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
  dividends: number;
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
      // dividends: quantity IS the cash amount → convert it; buy/sell: convert price+fee
      quantity: tx.type === "dividend" ? String(q * r) : String(q),
      price: String(p * r),
      fee: String(parseFloat(String(tx.fee)) * r),
      occurredAt: tx.occurredAt,
    });
  }
  return out;
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
        dividends: 0,
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
    } else if (tx.type === "sell") {
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
    } else {
      row.dividends += qty.toNumber();
      row.fees += fee.toNumber();
    }
    positions.set(assetKey, pos);

    row.invested = Math.round(row.invested * 100) / 100;
    row.soldProceeds = Math.round(row.soldProceeds * 100) / 100;
    row.realizedPL = Math.round(row.realizedPL * 100) / 100;
    row.dividends = Math.round(row.dividends * 100) / 100;
    row.fees = Math.round(row.fees * 100) / 100;

    map.set(month, row);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}
