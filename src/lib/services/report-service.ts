import { monthKey } from "@/lib/utils/date";

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
