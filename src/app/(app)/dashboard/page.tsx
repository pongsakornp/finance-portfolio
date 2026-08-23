import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getRate } from "@/lib/services/fx-service";
import {
  buildHoldingsView,
  getUserPortfolios,
  getUserTransactions,
} from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";
import { fmtMoney, fmtQty } from "@/lib/utils/money";

import { AllocationDonut } from "@/components/charts/allocation-donut";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { AddTransactionDialog } from "@/components/features/add-transaction-dialog";
import { PL, PLPct } from "@/components/pl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const [[user], portfolios] = await Promise.all([
    db.select({ baseCurrency: users.baseCurrency }).from(users).where(eq(users.id, userId)),
    getUserPortfolios(userId),
  ]);
  const baseCurrency = user?.baseCurrency ?? "USD";

  const txs = await getUserTransactions(userId);
  const view = await buildHoldingsView(txs);
  const t = view.totalsUsd;

  // single FX lookup for display conversion
  const rate =
    baseCurrency === "USD" ? 1 : (await getRate("USD", baseCurrency)).toNumber();
  const money = (usd: number) => fmtMoney(usd * rate, baseCurrency);

  const byType = new Map<string, number>();
  for (const row of view.rows) {
    if (row.position.qty > 0)
      byType.set(row.asset.type, (byType.get(row.asset.type) ?? 0) + row.valueUsd);
  }
  const typeLabels: Record<string, string> = {
    stock: "Stocks",
    etf: "ETFs",
    crypto: "Crypto",
  };
  const allocation = [...byType.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([type, value]) => ({ label: typeLabels[type] ?? type, value }));

  const holdings = view.rows.filter((r) => r.position.qty > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <AddTransactionDialog portfolios={portfolios} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total value</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{money(t.marketValue)}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            Today{" "}
            {t.dayChange !== 0 ? (
              <>
                <PL value={t.dayChange * rate} /> (
                <PLPct value={t.dayChangePct} />)
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cost basis</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{money(t.costBasis)}</CardTitle>
          </CardHeader>
          <CardContent />
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unrealized P/L</CardDescription>
            <CardTitle className="text-2xl">
              <PL value={t.unrealizedPL * rate} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <PLPct value={t.unrealizedPLPct} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Realized + Dividends</CardDescription>
            <CardTitle className="text-2xl">
              <PL
                value={(t.realizedPL + t.dividendsReceived) * rate}
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Dividends {money(t.dividendsReceived)}
          </CardContent>
        </Card>
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
            <AllocationDonut data={allocation} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings ({holdings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No open positions yet — add your first transaction.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Unrealized P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => (
                  <TableRow key={h.asset.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{h.asset.symbol}</span>
                        <Badge variant="outline" className="capitalize">
                          {h.asset.type}
                        </Badge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{h.asset.name}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtQty(h.position.qty)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(h.position.avgCost, h.asset.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(h.price, h.asset.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(h.valueUsd)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <PL value={h.position.unrealizedPL * rate} />
                      </div>
                      <PLPct value={h.position.unrealizedPLPct} className="text-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
