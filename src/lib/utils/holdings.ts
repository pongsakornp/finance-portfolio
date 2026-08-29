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
