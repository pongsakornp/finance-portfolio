import Decimal from "decimal.js";

Decimal.set({ precision: 28 });

export const D = Decimal;

/** numeric() columns come back as strings — parse once at the edge */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "string" ? parseFloat(v) : v;
}

export function d(v: string | number | null | undefined): Decimal {
  return new D(v ?? 0);
}

const fmtCache = new Map<string, Intl.NumberFormat>();

function formatter(currency: string): Intl.NumberFormat {
  let f = fmtCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    });
    fmtCache.set(currency, f);
  }
  return f;
}

export function fmtMoney(value: number, currency: string = "USD"): string {
  return formatter(currency).format(value);
}

export function fmtQty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

export function fmtPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
