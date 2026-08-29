import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { HoldingsList } from "@/components/features/holdings-list";
import { DeleteButton } from "@/components/features/delete-button";
import { CompactMoney } from "@/components/features/compact-money";
import { StatCard, TodayFooter } from "@/components/features/stat-card";
import { PL, PLPct } from "@/components/pl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { deleteTransactionAction } from "@/actions/transaction.actions";
import { deletePortfolioAction } from "@/actions/portfolio.actions";
import { db } from "@/lib/db";
import { portfolios, users } from "@/lib/db/schema";
import {
  buildHoldingsView,
  getUserTransactions,
} from "@/lib/services/view-service";
import { baseRate } from "@/lib/services/fx-service";
import { requireUserId } from "@/lib/session";
import { fmtDate, fmtMonthYear } from "@/lib/utils/date";
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

  const [txs, [user]] = await Promise.all([
    getUserTransactions(userId, id),
    db
      .select({ baseCurrency: users.baseCurrency, plView: users.plView })
      .from(users)
      .where(eq(users.id, userId)),
  ]);
  const baseCurrency = user?.baseCurrency ?? "USD";
  const plView = user?.plView ?? "unrealized";

  const view = await buildHoldingsView(txs);
  const t = view.totalsUsd;
  const rate = await baseRate(baseCurrency);
  const money = (usd: number) => fmtMoney(Math.round(usd * rate * 100) / 100, baseCurrency);
  const holdings = [...view.rows].filter((r) => r.position.qty > 0);
  const ledger = [...txs].reverse();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{row.name}</h1>
        </div>
        <div className="flex items-center gap-2">
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
          footer={<TodayFooter dayChange={t.dayChange} dayChangePct={t.dayChangePct} rate={rate} />}
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
          label="Realized + Dividends"
          title={<PL value={(t.realizedPL + t.dividendsReceived) * rate} currency={baseCurrency} compact />}
          footer={`Dividends ${money(t.dividendsReceived)}`}
        />
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
                const rowPl = holdingPl(h, rate, plView);
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
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <Empty className="p-8">
              <EmptyDescription>Nothing here yet.</EmptyDescription>
            </Empty>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Qty / Amount</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{fmtDate(tx.occurredAt)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              tx.type === "buy" ? "default" : tx.type === "sell" ? "warning" : "secondary"
                            }
                            className="capitalize"
                          >
                            {tx.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{tx.asset.symbol}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {tx.type === "dividend"
                            ? fmtMoney(parseFloat(tx.quantity), tx.asset.currency)
                            : fmtQty(parseFloat(tx.quantity))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {tx.type === "dividend" ? "—" : fmtMoney(parseFloat(tx.price), tx.asset.currency)}
                        </TableCell>
                        <TableCell>
                          <DeleteButton action={deleteTransactionAction.bind(null, tx.id)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 md:hidden">
                {ledger.map((tx) => (
                  <Card key={tx.id}>
                    <CardContent className="flex flex-col gap-1.5 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{fmtDate(tx.occurredAt)}</span>
                        <Badge
                          variant={
                            tx.type === "buy" ? "default" : tx.type === "sell" ? "warning" : "secondary"
                          }
                          className="capitalize"
                        >
                          {tx.type}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-medium">{tx.asset.symbol}</span>
                          <span className="text-sm text-muted-foreground"> · </span>
                          <span className="tabular-nums">
                            {tx.type === "dividend"
                              ? fmtMoney(parseFloat(tx.quantity), tx.asset.currency)
                              : fmtQty(parseFloat(tx.quantity))}
                          </span>
                          {tx.type !== "dividend" && (
                            <span className="tabular-nums text-muted-foreground">
                              {" "}
                              @ {fmtMoney(parseFloat(tx.price), tx.asset.currency)}
                            </span>
                          )}
                        </div>
                        <DeleteButton action={deleteTransactionAction.bind(null, tx.id)} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
