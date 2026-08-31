"use client";

import { Cell, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { fmtMoney } from "@/lib/utils/money";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function AllocationDonut({
  data,
  currency = "USD",
}: {
  data: Array<{ label: string; value: number }>;
  currency?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
        Add transactions to see allocation
      </div>
    );
  }

  const items = data.map((d, i) => ({ ...d, id: String(i) }));
  const config: ChartConfig = Object.fromEntries(
    items.map((d, i) => [
      d.id,
      { label: d.label, color: CHART_COLORS[i % CHART_COLORS.length] },
    ])
  );

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-[260px] w-full">
      <PieChart>
        <Pie
          data={items}
          dataKey="value"
          nameKey="id"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={2}
          strokeWidth={0}
        >
          {items.map((d) => (
            <Cell key={d.id} fill={`var(--color-${d.id})`} />
          ))}
        </Pie>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="id"
              hideLabel
              formatter={(value, _name, item) => (
                <>
                  <span className="text-muted-foreground">
                    {item?.payload?.label ?? "—"}
                  </span>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {fmtMoney(Number(value), currency)}
                  </span>
                </>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent nameKey="id" />} />
      </PieChart>
    </ChartContainer>
  );
}
