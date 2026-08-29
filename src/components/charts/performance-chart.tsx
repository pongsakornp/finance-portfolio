"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from "recharts";

import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

type Point = { day: string; pct: number };

export function PerformanceChart({ baseLabel }: { baseLabel: string }) {
  const [days, setDays] = useState(90);
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [portfolio, setPortfolio] = useState<Point[]>([]);
  const [benchmark, setBenchmark] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/performance?days=${days}`)
      .then((r) => r.json())
      .then(
        (json: { portfolio: Point[]; benchmark: Point[] }) => {
          if (cancelled) return;
          setPortfolio(json.portfolio ?? []);
          setBenchmark(json.benchmark ?? []);
          setLoading(false);
        },
        () => {
          if (!cancelled) setLoading(false);
        }
      );
    return () => {
      cancelled = true;
    };
  }, [days]);

  const merged = portfolio.map((p) => ({
    day: p.day,
    portfolio: p.pct,
    benchmark: showBenchmark
      ? benchmark.find((b) => b.day === p.day)?.pct ?? null
      : null,
  }));

  const benchmarkUnavailable =
    showBenchmark && !loading && portfolio.length > 0 && benchmark.length === 0;

  const config: ChartConfig = {
    portfolio: { label: baseLabel, color: "var(--chart-2)" },
    benchmark: { label: "S&P 500", color: "var(--muted-foreground)" },
  };

  const ranges = [
    [30, "1M"],
    [90, "3M"],
    [180, "6M"],
    [365, "1Y"],
  ] as const;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          variant="outline"
          size="sm"
          spacing={0}
          value={[String(days)]}
          onValueChange={(v) => v[0] && setDays(Number(v[0]))}
        >
          {ranges.map(([d, label]) => (
            <ToggleGroupItem key={d} value={String(d)}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={showBenchmark}
            onCheckedChange={(c) => setShowBenchmark(c)}
            aria-label="Show S&P 500 benchmark"
          />
          vs S&amp;P 500
          {benchmarkUnavailable && (
            <span className="text-muted-foreground/80">· S&amp;P data unavailable</span>
          )}
        </Label>
      </div>
      <div className="h-[280px]">
        {merged.length === 0 ? (
          <Empty className="h-full justify-center">
            <EmptyDescription>
              Not enough history yet — add transactions or wait for snapshots
            </EmptyDescription>
          </Empty>
        ) : (
          <ChartContainer config={config} className="aspect-auto h-full w-full">
            <AreaChart data={merged} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
                tickFormatter={(d: string) => d.slice(5)}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={50}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(l) => String(l)}
                    formatter={(value, name) => (
                      <>
                        <span className="text-muted-foreground">
                          {String(name) === "portfolio" ? baseLabel : "S&P 500"}
                        </span>
                        <span className="font-mono font-medium tabular-nums">
                          {value == null
                            ? "—"
                            : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)}%`}
                        </span>
                      </>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="portfolio"
                stroke="var(--color-portfolio)"
                fill="url(#pf)"
                strokeWidth={2}
                connectNulls
              />
              {showBenchmark && (
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="var(--color-benchmark)"
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </AreaChart>
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
