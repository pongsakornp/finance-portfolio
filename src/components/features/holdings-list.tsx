"use client"

import * as React from "react"
import { SearchIcon } from "lucide-react"

import { PL, PLPct } from "@/components/pl"
import { Badge } from "@/components/ui/badge"
import { Empty, EmptyDescription } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export type HoldingsListItem = {
  id: string;
  symbol: string;
  name: string;
  type: string;
  typeLabel: string;
  qty: string;
  qtyLabel: string;
  avgCost: string;
  price: string;
  value: string;
  pl: number;
  plPct: number;
  firstBuyLabel: string;
};

export function HoldingsList({ items }: { items: HoldingsListItem[] }) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<string>("all");

  const types = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      if (!seen.has(item.type)) seen.set(item.type, item.typeLabel);
    }
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [items]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (q && !item.symbol.toLowerCase().includes(q) && !item.name.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [items, query, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <SearchIcon
            data-icon="inline-start"
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search holdings or tickers..."
            className="pl-9"
          />
        </div>
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[filter]}
          onValueChange={(v) => setFilter(v[0] ?? "all")}
        >
          <ToggleGroupItem value="all">All</ToggleGroupItem>
          {types.map((t) => (
            <ToggleGroupItem key={t.value} value={t.value}>
              {t.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {filtered.length === 0 ? (
        <Empty className="p-8">
          <EmptyDescription>No holdings match.</EmptyDescription>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-3xl border">
          {filtered.map((h, i) => (
            <div key={h.id}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 p-4 sm:gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border bg-muted/40 text-sm font-semibold">
                  {h.symbol}
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate font-medium">{h.name}</span>
                    <Badge variant="outline" className="shrink-0 rounded-full capitalize">
                      {h.typeLabel}
                    </Badge>
                  </div>
                  <span className="truncate text-xs uppercase tracking-wide text-muted-foreground">
                    {h.qty} {h.qtyLabel} · {h.firstBuyLabel}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    Avg {h.avgCost} · Price {h.price}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Value
                  </span>
                  <span className="font-semibold tabular-nums">{h.value}</span>
                  <span className="text-xs">
                    <PL value={h.pl} /> (<PLPct value={h.plPct} />)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
