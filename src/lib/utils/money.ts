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
      currencyDisplay: "narrowSymbol", // ฿ for THB, $ for USD
      maximumFractionDigits: 2,
    });
    fmtCache.set(currency, f);
  }
  return f;
}

const compactCache = new Map<string, Intl.NumberFormat>();

function compactFormatter(currency: string): Intl.NumberFormat {
  let f = compactCache.get(currency);
  if (!f) {
    f = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 1,
    });
    compactCache.set(currency, f);
  }
  return f;
}

export function fmtMoney(value: number, currency: string = "USD"): string {
  return formatter(currency).format(value);
}

/** Compact form for large amounts, e.g. ฿2.2M, $1.2k (values < 1000 unchanged). */
export function fmtMoneyCompact(value: number, currency: string = "USD"): string {
  return compactFormatter(currency).format(value).replace("K", "k");
}

export function fmtQty(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(value);
}

/** Pad a numeric string / number to exactly `dp` decimals. */
export function padDecimals(v: string | number | null | undefined, dp = 4): string {
  if (v === null || v === undefined) return "0";
  return Decimal(v ?? 0).toFixed(dp);
}

export function fmtPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}
