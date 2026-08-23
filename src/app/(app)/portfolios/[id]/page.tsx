import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { AddTransactionDialog } from "@/components/features/add-transaction-dialog";
import { DeleteButton } from "@/components/features/delete-button";
import { PL, PLPct } from "@/components/pl";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
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
import { deleteTransactionAction } from "@/actions/transaction.actions";
import { db } from "@/lib/db";
import { portfolios, users } from "@/lib/db/schema";
import {
  buildHoldingsView,
  getUserTransactions,
} from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";
import { fmtDate } from "@/lib/utils/date";
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
    db.select({ baseCurrency: users.baseCurrency }).from(users).where(eq(users.id, userId)),
  ]);
  const baseCurrency = user?.baseCurrency ?? "USD";

  const view = await buildHoldingsView(txs);
  const t = view.totalsUsd;
  const holdings = [...view.rows].filter((r) => r.position.qty > 0);
  const ledger = [...txs].reverse();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/portfolios" className="text-xs text-muted-foreground hover:underline">
            ← Portfolios
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{row.name}</h1>
        </div>
        <AddTransactionDialog portfolios={[{ id, name: row.name }]} defaultPortfolioId={id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Total value" value={fmtMoney(t.marketValue, baseCurrency)} />
        <Stat title="Cost basis" value={fmtMoney(t.costBasis, baseCurrency)} />
        <Stat
          title="Unrealized P/L"
          node={
            <>
              <PL value={t.unrealizedPL} /> (<PLPct value={t.unrealizedPLPct} />)
            </>
          }
        />
        <Stat
          title="Realized P/L"
          node={<PL value={t.realizedPL} />}
          sub={`Dividends ${fmtMoney(t.dividendsReceived, baseCurrency)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Holdings ({holdings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {holdings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No open positions.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">P/L</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => (
                  <TableRow key={h.asset.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{h.asset.symbol}</span>
                        <Badge variant="outline" className="capitalize">{h.asset.type}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtQty(h.position.qty)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(h.position.avgCost, h.asset.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(h.price, h.asset.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(h.valueUsd, baseCurrency)}
                    </TableCell>
                    <TableCell className="text-right">
                      <PL value={h.position.unrealizedPL} />
                      <PLPct value={h.position.unrealizedPLPct} className="ml-1 text-xs" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transactions ({ledger.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  title,
  value,
  node,
  sub,
}: {
  title: string;
  value?: string;
  node?: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="text-2xl font-semibold tabular-nums">{value ?? node}</div>
      </CardHeader>
      {sub && <CardContent className="text-sm text-muted-foreground">{sub}</CardContent>}
    </Card>
  );
}
