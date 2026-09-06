import { PLPct } from "@/components/pl";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import type { DashboardInsights } from "@/lib/services/dashboard-insights-service";
import { fmtMoneyCompact } from "@/lib/utils/money";

function HoldingName({ symbol, name }: { symbol: string; name: string }) {
  return (
    <span className="min-w-0 truncate text-sm font-medium">
      {symbol}
      {name !== symbol && <span className="text-muted-foreground"> · {name}</span>}
    </span>
  );
}

export function DashboardRiskMovers({
  insights,
  currency,
  rate,
}: {
  insights: DashboardInsights | null;
  currency: string;
  rate: number;
}) {
  if (!insights) {
    return (
      <Empty className="h-[220px] justify-center">
        <EmptyDescription>No priced holdings yet.</EmptyDescription>
      </Empty>
    );
  }

  const mover = insights.bestMover;
  return (
    <dl className="flex min-h-[220px] flex-col divide-y">
      <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
        <dt className="text-sm text-muted-foreground">Largest position</dt>
        <dd className="min-w-0 text-right">
          <HoldingName symbol={insights.largest.symbol} name={insights.largest.name} />
          <div className="text-xs tabular-nums text-muted-foreground">
            {fmtMoneyCompact(insights.largest.valueUsd * rate, currency)} · {insights.largest.weightPct.toFixed(2)}%
          </div>
        </dd>
      </div>
      <div className="flex items-center justify-between gap-4 py-3">
        <dt className="text-sm text-muted-foreground">Top 5 concentration</dt>
        <dd className="text-sm font-medium tabular-nums">{insights.topFiveWeightPct.toFixed(2)}%</dd>
      </div>
      {mover ? (
        <div className="flex items-center justify-between gap-4 py-3">
          <dt className="text-sm text-muted-foreground">
            {insights.worstMover ? "Best today" : "Today’s mover"}
          </dt>
          <dd className="min-w-0 text-right">
            <HoldingName symbol={mover.symbol} name={mover.name} />
            <div><PLPct value={mover.dayChangePct} className="text-xs" /></div>
          </dd>
        </div>
      ) : (
        <div className="py-3 text-sm text-muted-foreground">Daily price data unavailable.</div>
      )}
      {insights.worstMover && (
        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
          <dt className="text-sm text-muted-foreground">Worst today</dt>
          <dd className="min-w-0 text-right">
            <HoldingName symbol={insights.worstMover.symbol} name={insights.worstMover.name} />
            <div><PLPct value={insights.worstMover.dayChangePct} className="text-xs" /></div>
          </dd>
        </div>
      )}
    </dl>
  );
}
