"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fmtMoney } from "@/lib/utils/money";

export type MonthlyBarDatum = { month: string; value: number };

export function MonthlyBarsChart({
  data,
  label,
  currency,
}: {
  data: MonthlyBarDatum[];
  label: string;
  currency: string;
}) {
  const config: ChartConfig = { value: { label, color: "var(--primary)" } };

  const axisCompact = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });

  return (
    <div className="h-[220px]">
      {data.length === 0 ? (
        <Empty className="h-full justify-center">
          <EmptyDescription>No data yet.</EmptyDescription>
        </Empty>
      ) : (
        <ChartContainer config={config} className="aspect-auto h-full w-full">
          <BarChart data={data} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={30}
              tickFormatter={(m: string) => {
                const [y, mo] = m.split("-");
                return `${mo}/${y.slice(2)}`;
              }}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => axisCompact.format(v)}
              width={60}
            />
            <ChartTooltip
              cursor={{ fill: "var(--muted)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(l) => String(l)}
                  formatter={(value) => (
                    <span className="font-mono font-medium tabular-nums">
                      {fmtMoney(Number(value), currency)}
                    </span>
                  )}
                />
              }
            />
            <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  );
}
