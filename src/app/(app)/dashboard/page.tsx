import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { baseRate } from "@/lib/services/fx-service";
import {
  buildHoldingsView,
  getUserTransactions,
} from "@/lib/services/view-service";
import { monthlyBreakdown, toUsdReportTxs } from "@/lib/services/report-service";
import { buildDashboardInsights } from "@/lib/services/dashboard-insights-service";
import { requireUserId } from "@/lib/session";
import { fmtMonthYear } from "@/lib/utils/date";
import { holdingPl, typeLabel, typeUnitLabel } from "@/lib/utils/holdings";
import { fmtMoney, fmtQty } from "@/lib/utils/money";

import { AllocationDonut } from "@/components/charts/allocation-donut";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { MonthlyBarsChart } from "@/components/charts/monthly-bars-chart";
import {
  HoldingsList,
} from "@/components/features/holdings-list";
import { CompactMoney } from "@/components/features/compact-money";
import { DashboardRiskMovers } from "@/components/features/dashboard-risk-movers";
import { StatCard, TodayFooter } from "@/components/features/stat-card";
import { PL, PLPct } from "@/components/pl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [userRows, txs] = await Promise.all([
    db
      .select({ baseCurrency: users.baseCurrency, plView: users.plView })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
    getUserTransactions(userId),
  ]);
  const user = userRows[0];
  const baseCurrency = user?.baseCurrency ?? "USD";
  const plView = user?.plView ?? "unrealized";

  const [view, rate, reportTxs] = await Promise.all([
    buildHoldingsView(txs),
    baseRate(baseCurrency),
    toUsdReportTxs(txs),
  ]);
  const t = view.totalsUsd;

  const byType = new Map<string, number>();
  for (const row of view.rows) {
    if (row.position.qty > 0)
      byType.set(row.asset.type, (byType.get(row.asset.type) ?? 0) + row.valueUsd);
  }
  const typeLabels: Record<string, string> = {
    stock: "Stocks",
    etf: "ETFs",
    crypto: "Crypto",
    commodity: "Commodities",
    mutualfund: "Fund",
  };
  const allocation = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({
      label: typeLabels[type] ?? type,
      value: Math.round(value * rate * 100) / 100,
    }));

  const holdings = view.rows.filter((r) => r.position.qty > 0);
  const insights = buildDashboardInsights(
    holdings.map((holding) => ({
      symbol: holding.asset.symbol,
      name: holding.asset.name,
      valueUsd: holding.valueUsd,
      previousClose: holding.previousClose,
      dayChangePct: holding.dayChangePct,
    }))
  );

  // monthly cash-flow in USD, then displayed in base currency
  const monthly = monthlyBreakdown(reportTxs).reverse();
  const contribution = monthly.map((r) => ({
    month: r.month,
    value: Math.round((r.invested - r.soldProceeds) * rate * 100) / 100,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total value"
          title={<CompactMoney value={t.marketValue * rate} currency={baseCurrency} />}
          footer={<TodayFooter dayChange={t.dayChange} dayChangePct={t.dayChangePct} rate={rate} currency={baseCurrency} />}
        />
        <StatCard
          label="Cost basis"
          title={<CompactMoney value={t.costBasis * rate} currency={baseCurrency} />}
        />
        <StatCard
          label="Unrealized P/L"
          title={<PL value={t.unrealizedPL * rate} currency={baseCurrency} compact />}
          footer={<PLPct value={t.unrealizedPLPct} />}
          footerClassName="text-sm"
        />
        <StatCard
          label="Realized"
          title={<PL value={t.realizedPL * rate} currency={baseCurrency} compact />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Performance vs S&P 500</CardTitle>
            <CardDescription>% change over period</CardDescription>
          </CardHeader>
          <CardContent>
            <PerformanceChart baseLabel="Portfolio" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation</CardTitle>
            <CardDescription>By asset class</CardDescription>
          </CardHeader>
          <CardContent>
            <AllocationDonut data={allocation} currency={baseCurrency} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contribution by month</CardTitle>
            <CardDescription>Net capital added ({baseCurrency})</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBarsChart
              data={contribution}
              label="Contribution"
              currency={baseCurrency}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Risk &amp; movers</CardTitle>
            <CardDescription>Concentration and daily price movement</CardDescription>
          </CardHeader>
          <CardContent>
            <DashboardRiskMovers insights={insights} currency={baseCurrency} rate={rate} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings ({holdings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <Empty className="p-8">
              <EmptyDescription>
                No open positions yet — add your first transaction.
              </EmptyDescription>
            </Empty>
          ) : (
            <HoldingsList
              items={holdings.map((h) => {
                const rowPl = holdingPl(
                  {
                    unrealizedPlUsd: h.unrealizedPlUsd,
                    dayChangeUsd: h.dayChangeUsd,
                    unrealizedPLPct: h.position.unrealizedPLPct,
                    dayChangePct: h.dayChangePct,
                  },
                  rate,
                  plView
                );
                return {
                  id: h.asset.id,
                  symbol: h.asset.symbol,
                  name: h.asset.name,
                  type: h.asset.type,
                  typeLabel: typeLabel(h.asset.type),
                  qty: fmtQty(h.position.qty),
                  qtyLabel: typeUnitLabel(h.asset.type),
                  avgCost: fmtMoney(h.position.avgCost, h.asset.currency),
                  price: fmtMoney(h.price, h.asset.currency),
                  valueNum: Math.round(h.valueUsd * rate * 100) / 100,
                  valueCurrency: baseCurrency,
                  pl: rowPl.pl,
                  plCurrency: baseCurrency,
                  plPct: rowPl.plPct,
                  firstBuyLabel: fmtMonthYear(h.firstBuyAt),
                };
              })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
