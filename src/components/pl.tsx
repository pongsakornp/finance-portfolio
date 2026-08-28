import { cn } from "@/lib/utils";
import { fmtMoney } from "@/lib/utils/money";

/** Signed, colored P/L amount or percent */
export function PL({
  value,
  suffix,
  currency,
  className,
}: {
  value: number;
  suffix?: string;
  currency?: string;
  className?: string;
}) {
  const positive = value > 0;
  const neutral = value === 0;
  return (
    <span
      className={cn(
        "font-medium tabular-nums",
        neutral ? "text-muted-foreground" : positive ? "text-success" : "text-destructive",
        className
      )}
    >
      {currency
        ? `${positive ? "+" : ""}${fmtMoney(value, currency)}`
        : `${neutral ? "" : positive ? "+" : ""}${value.toLocaleString("en-US", {
            maximumFractionDigits: 2,
          })}`}
      {suffix}
    </span>
  );
}

export function PLPct({ value, className }: { value: number; className?: string }) {
  return <PL value={value} suffix="%" className={className} />;
}
