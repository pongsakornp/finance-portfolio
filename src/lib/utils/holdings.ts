const TYPE_LABEL: Record<string, string> = {
  stock: "Stock",
  etf: "ETF",
  crypto: "Crypto",
  mutualfund: "Fund",
  commodity: "Commodity",
};

const TYPE_UNIT: Record<string, string> = {
  stock: "SHARES",
  etf: "SHARES",
  crypto: "UNITS",
  mutualfund: "UNITS",
  commodity: "UNITS",
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
  unrealizedPlUsd: number;
  dayChangeUsd: number;
  unrealizedPLPct: number;
  dayChangePct: number;
};

/** P/L for a holding row, expressed in base currency via a USD→base `rate`. */
export function holdingPl(
  h: HoldingPlInput,
  rate: number,
  plView: string
): { pl: number; plPct: number } {
  if (plView === "daily") {
    return { pl: h.dayChangeUsd * rate, plPct: h.dayChangePct };
  }
  return { pl: h.unrealizedPlUsd * rate, plPct: h.unrealizedPLPct };
}
