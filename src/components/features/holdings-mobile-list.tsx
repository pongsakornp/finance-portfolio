import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PL, PLPct } from "@/components/pl";

export type HoldingsMobileItem = {
  key: string;
  symbol: string;
  name: string;
  type: string;
  qty: string;
  avgCost: string;
  price: string;
  value: string;
  pl: number;
  plPct: number;
};

export function HoldingsMobileList({ items }: { items: HoldingsMobileItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 md:hidden">
      {items.map((h) => (
        <Card key={h.key}>
          <CardContent className="flex flex-col gap-1.5 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">{h.symbol}</span>
                <Badge variant="outline" className="capitalize">{h.type}</Badge>
              </div>
              <span className="font-medium tabular-nums">{h.value}</span>
            </div>
            <p className="truncate text-xs text-muted-foreground">{h.name}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">Qty {h.qty}</span>
              <span className="tabular-nums">Avg {h.avgCost}</span>
              <span className="tabular-nums">Price {h.price}</span>
            </div>
            <div className="text-sm">
              <PL value={h.pl} />{" "}
              <PLPct value={h.plPct} className="text-xs" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
