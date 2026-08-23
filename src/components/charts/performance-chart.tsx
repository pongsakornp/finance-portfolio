"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Point = { day: string; pct: number };

export function PerformanceChart({ baseLabel }: { baseLabel: string }) {
  const [days, setDays] = useState(90);
  const [showBenchmark, setShowBenchmark] = useState(true);
  const [portfolio, setPortfolio] = useState<Point[]>([]);
  const [benchmark, setBenchmark] = useState<Point[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/performance?days=${days}`)
      .then((r) => r.json())
      .then(
        (json: { portfolio: Point[]; benchmark: Point[] }) => {
          if (cancelled) return;
          setPortfolio(json.portfolio ?? []);
          setBenchmark(json.benchmark ?? []);
        },
        () => {}
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

  const ranges = [
    [30, "1M"],
    [90, "3M"],
    [180, "6M"],
    [365, "1Y"],
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {ranges.map(([d, label]) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                days === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showBenchmark}
            onChange={(e) => setShowBenchmark(e.target.checked)}
            className="accent-primary"
          />
          vs S&amp;P 500
        </label>
      </div>
      <div className="h-[280px]">
        {merged.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Not enough history yet — add transactions or wait for snapshots
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
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
              <Tooltip
                formatter={(value, name) => [
                  value == null
                    ? "—"
                    : `${Number(value) > 0 ? "+" : ""}${Number(value).toFixed(2)}%`,
                  String(name) === "portfolio" ? baseLabel : "S&P 500",
                ]}
                labelFormatter={(label) => `Day ${String(label)}`}
              />
              <Area
                type="monotone"
                dataKey="portfolio"
                stroke="var(--chart-2)"
                fill="url(#pf)"
                strokeWidth={2}
                connectNulls
              />
              {showBenchmark && (
                <Line
                  type="monotone"
                  dataKey="benchmark"
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
