const TYPE_LABEL: Record<string, string> = {
  stock: "Stock",
  etf: "ETF",
  crypto: "Crypto",
  mutualfund: "Fund",
  commodity: "Commodity",
  cash: "Cash",
};

const TYPE_UNIT: Record<string, string> = {
  stock: "SHARES",
  etf: "SHARES",
  crypto: "UNITS",
  mutualfund: "UNITS",
  commodity: "UNITS",
  cash: "UNITS",
};

export function typeLabel(type: string) {
  return TYPE_LABEL[type] ?? type;
}

export function typeUnitLabel(type: string) {
  return TYPE_UNIT[type] ?? "SHARES";
}

/** Avatar text: strip ".SUFFIX" (e.g. PTT.BK → PTT); long names → first char. */
export function avatarText(symbol: string): string {
  const base = symbol.split(".")[0].trim();
  return base.length > 4 ? base.charAt(0) : base;
}

export type HoldingPlInput = {
  price: number;
  previousClose: number | null;
  position: { qty: number; unrealizedPL: number; unrealizedPLPct: number };
};

/** P/L for a holding row — unrealized since open (default) or daily change. */
export function holdingPl(
  h: HoldingPlInput,
  rate: number,
  plView: string
): { pl: number; plPct: number } {
  if (plView === "daily") {
    const prev = h.previousClose;
    if (prev == null || prev <= 0) return { pl: 0, plPct: 0 };
    const daily = (h.price - prev) * h.position.qty;
    return { pl: daily * rate, plPct: ((h.price - prev) / prev) * 100 };
  }
  return {
    pl: h.position.unrealizedPL * rate,
    plPct: h.position.unrealizedPLPct,
  };
}
