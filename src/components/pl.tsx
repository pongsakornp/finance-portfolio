import { cn } from "@/lib/utils";

/** Signed, colored P/L amount or percent */
export function PL({
  value,
  suffix,
  className,
}: {
  value: number;
  suffix?: string;
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
      {neutral ? "" : positive ? "+" : ""}
      {value.toLocaleString("en-US", { maximumFractionDigits: 2 })}
      {suffix}
    </span>
  );
}

export function PLPct({ value, className }: { value: number; className?: string }) {
  return <PL value={value} suffix="%" className={className} />;
}
