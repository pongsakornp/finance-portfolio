export const CHART_RANGES = [
  [30, "1M"],
  [90, "3M"],
  [180, "6M"],
  [365, "1Y"],
  [1095, "3Y"],
  [1825, "5Y"],
] as const;

export const CHART_EMPTY_TEXT =
  "Not enough history yet — add transactions or wait for price history";
