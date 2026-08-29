import { monthKey } from "@/lib/utils/date";
import { getRate } from "@/lib/services/fx-service";
import type { TxRow } from "@/lib/services/view-service";

export type TxForReport = {
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
      out.push(tx);
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
  const map = new Map<string, MonthlyRow>();
  for (const tx of txs) {
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

    const qty = parseFloat(String(tx.quantity));
    const price = parseFloat(String(tx.price));
    const fee = parseFloat(String(tx.fee ?? 0));

    if (tx.type === "buy") {
      row.invested += qty * price + fee;
    } else if (tx.type === "sell") {
      row.soldProceeds += qty * price - fee;
    } else {
      row.dividends += qty;
      row.fees += fee;
    }
    map.set(month, row);
  }
  return [...map.values()].sort((a, b) => b.month.localeCompare(a.month));
}
