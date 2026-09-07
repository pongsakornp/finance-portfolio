import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { DownloadIcon } from "lucide-react";

import { AllocationDonut } from "@/components/charts/allocation-donut";
import { UnrealizedPLChart } from "@/components/charts/unrealized-pl-chart";
import { HoldingsList } from "@/components/features/holdings-list";
import { DeleteButton } from "@/components/features/delete-button";
import { TransactionLedger } from "@/components/features/transaction-ledger";
import { TransactionDialog } from "@/components/features/transaction-dialog";
import { RenamePortfolioDialog } from "@/components/features/rename-portfolio-dialog";
import { CompactMoney } from "@/components/features/compact-money";
import { StatCard, TodayFooter } from "@/components/features/stat-card";
import { PL, PLPct } from "@/components/pl";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { deletePortfolioAction } from "@/actions/portfolio.actions";
import { db } from "@/lib/db";
import { portfolios, users } from "@/lib/db/schema";
import {
  buildHoldingsView,
  getUserPortfolios,
  getUserTransactions,
} from "@/lib/services/view-service";
import { baseRate } from "@/lib/services/fx-service";
import { requireUserId } from "@/lib/session";
import { fmtMonthYear } from "@/lib/utils/date";
import { holdingPl, typeLabel, typeUnitLabel } from "@/lib/utils/holdings";
import { fmtMoney, fmtQty } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await requireUserId();

  const [row] = await db
    .select({ name: portfolios.name })
    .from(portfolios)
    .innerJoin(users, eq(users.id, portfolios.userId))
    .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
    .limit(1);
  if (!row) notFound();

  const [txs, portfoliosList, [user]] = await Promise.all([
    getUserTransactions(userId, id),
    getUserPortfolios(userId),
    db
      .select({ baseCurrency: users.baseCurrency, plView: users.plView })
      .from(users)
      .where(eq(users.id, userId)),
  ]);
  const baseCurrency = user?.baseCurrency ?? "USD";
  const plView = user?.plView ?? "unrealized";

  const [view, rate] = await Promise.all([buildHoldingsView(txs), baseRate(baseCurrency)]);
  const t = view.totalsUsd;
  const holdings = [...view.rows].filter((r) => r.position.qty > 0);
  const ledger = [...txs].reverse();
  const allocationRows = holdings
    .map((holding) => ({
      label: holding.asset.symbol,
      value: Math.round(holding.valueUsd * rate * 100) / 100,
    }))
    .sort((a, b) => b.value - a.value);
  const allocation = allocationRows.length > 8
    ? [
        ...allocationRows.slice(0, 8),
        {
          label: "Other",
          value: Math.round(
            allocationRows.slice(8).reduce((total, holding) => total + holding.value, 0) * 100
          ) / 100,
        },
      ]
    : allocationRows;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{row.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <RenamePortfolioDialog id={id} initialName={row.name} />
          <Button
            variant="ghost"
            size="icon"
            aria-label="Export holdings"
            render={<a href={`/api/portfolios/${id}/export`} download />}
          >
            <DownloadIcon className="text-muted-foreground" />
          </Button>
          <DeleteButton
            action={deletePortfolioAction.bind(null, id)}
            confirmText={`Delete "${row.name}" and all its transactions?`}
            redirectTo="/portfolios"
          />
        </div>
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
            <CardTitle className="text-base">Unrealized P/L</CardTitle>
          </CardHeader>
          <CardContent>
            <UnrealizedPLChart portfolioId={id} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation</CardTitle>
          </CardHeader>
          <CardContent>
            <AllocationDonut data={allocation} currency={baseCurrency} />
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
              <EmptyDescription>No open positions.</EmptyDescription>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions ({ledger.length})</CardTitle>
          <CardAction>
            <TransactionDialog portfolios={portfoliosList} defaultPortfolioId={id} />
          </CardAction>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <Empty className="p-8">
              <EmptyDescription>Nothing here yet.</EmptyDescription>
            </Empty>
          ) : (
            <TransactionLedger
              transactions={ledger}
              portfolios={portfoliosList}
              showPortfolio={false}
              showFee={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
