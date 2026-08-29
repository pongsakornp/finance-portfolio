import { fmtMoney, fmtMoneyCompact } from "@/lib/utils/money";

/**
 * Renders a currency amount that auto-shortens when its container is narrow.
 * Shows the full value on wide containers (>= 280px) and the compact form
 * (e.g. ฿2.2M) on tight ones. Container-query based — no JS, SSR-safe.
 */
export function CompactMoney({
  value,
  currency,
  className,
}: {
  value: number;
  currency: string;
  className?: string;
}) {
  return (
    <span className={`@container block ${className ?? ""}`}>
      <span className="@max-[279px]:hidden">{fmtMoney(value, currency)}</span>
      <span className="@min-[280px]:hidden">{fmtMoneyCompact(value, currency)}</span>
    </span>
  );
}
