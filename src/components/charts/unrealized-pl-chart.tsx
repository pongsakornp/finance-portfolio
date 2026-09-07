"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";

import { PL } from "@/components/pl";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fmtMoneyCompact } from "@/lib/utils/money";

type Point = { day: string; value: number };

const ranges = [
  [30, "1M"],
  [90, "3M"],
  [180, "6M"],
  [365, "1Y"],
  [1095, "3Y"],
  [1825, "5Y"],
] as const;

export function UnrealizedPLChart({ portfolioId }: { portfolioId: string }) {
  const [days, setDays] = useState(90);
  const [points, setPoints] = useState<Point[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/portfolios/${portfolioId}/unrealized-pl?days=${days}`)
      .then((response) => response.json())
      .then(
        (json: { points?: Point[]; currency?: string }) => {
          if (cancelled) return;
          setPoints(json.points ?? []);
          setCurrency(json.currency ?? "USD");
          setLoading(false);
        },
        () => {
          if (!cancelled) setLoading(false);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [days, portfolioId]);

  const config: ChartConfig = {
    unrealized: { label: "Unrealized P/L", color: "var(--chart-2)" },
  };

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        variant="outline"
        size="sm"
        spacing={0}
        value={[String(days)]}
        onValueChange={(value) => {
          if (!value[0]) return;
          setLoading(true);
          setDays(Number(value[0]));
        }}
        aria-label="Unrealized P/L range"
      >
        {ranges.map(([value, label]) => (
          <ToggleGroupItem key={value} value={String(value)}>{label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="h-[280px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
        ) : points.length === 0 ? (
          <Empty className="h-full justify-center">
            <EmptyDescription>Not enough history yet — add transactions or wait for price history</EmptyDescription>
          </Empty>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-full w-full">
            <AreaChart data={points} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="unrealized-pl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={40} tickFormatter={(day: string) => day.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} tickFormatter={(value: number) => fmtMoneyCompact(value, currency)} />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={(label) => String(label)} formatter={(value) => <PL value={Number(value)} currency={currency} />} />}
              />
              <Area type="monotone" dataKey="value" name="unrealized" stroke="var(--color-unrealized)" fill="url(#unrealized-pl)" strokeWidth={2} connectNulls />
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
