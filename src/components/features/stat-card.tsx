import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PL, PLPct } from "@/components/pl";

export function StatCard({
  label,
  title,
  footer,
  footerClassName,
}: {
  label: string;
  title: React.ReactNode;
  footer?: React.ReactNode;
  footerClassName?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums font-sans">{title}</CardTitle>
      </CardHeader>
      {footer && (
        <CardContent className={footerClassName ?? "text-sm text-muted-foreground"}>
          {footer}
        </CardContent>
      )}
    </Card>
  );
}

/** Shared "Today … (+x.xx%)" footer for Total value cards. */
export function TodayFooter({
  dayChange,
  dayChangePct,
  rate,
  currency,
}: {
  dayChange: number;
  dayChangePct: number;
  rate: number;
  currency: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1">
      Today{" "}
      {dayChange !== 0 ? (
        <>
          <PL value={dayChange * rate} currency={currency} compact /> (<PLPct value={dayChangePct} />)
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </div>
  );
}
