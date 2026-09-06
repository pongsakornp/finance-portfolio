import { TransactionDialog } from "@/components/features/transaction-dialog";
import { DeleteButton } from "@/components/features/delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { getUserPortfolios, getUserTransactions } from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";
import { fmtDate } from "@/lib/utils/date";
import { fmtMoney, fmtQty } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const userId = await requireUserId();
  const [txs, portfolios] = await Promise.all([
    getUserTransactions(userId),
    getUserPortfolios(userId),
  ]);
  const nameById = new Map(portfolios.map((p) => [p.id, p.name]));
  const ledger = [...txs].reverse();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" nativeButton={false} render={<a href="/api/export" download>Export JSON</a>} />
          <TransactionDialog portfolios={portfolios} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All portfolios ({ledger.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <Empty className="p-8">
              <EmptyDescription>No transactions yet.</EmptyDescription>
            </Empty>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Portfolio</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Qty / Amount</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Fee</TableHead>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>{fmtDate(tx.occurredAt)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {nameById.get(tx.portfolioId) ?? "—"}
                        </TableCell>
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
                        <TableCell className="font-medium">
                          {tx.asset.name !== tx.asset.symbol && (
                            <span className="mr-1.5 text-xs font-normal text-muted-foreground">{tx.asset.symbol}</span>
                          )}
                          {tx.asset.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtQty(parseFloat(tx.quantity))}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtMoney(parseFloat(tx.price), tx.asset.currency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {parseFloat(tx.fee) ? fmtMoney(parseFloat(tx.fee), tx.asset.currency) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <TransactionDialog portfolios={portfolios} transaction={tx} />
                            <DeleteButton action={deleteTransactionAction.bind(null, tx.id)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ol className="flex flex-col divide-y md:hidden">
                {ledger.map((tx) => (
                  <li key={tx.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={tx.type === "buy" ? "default" : "warning"}
                            className="capitalize"
                          >
                            {tx.type}
                          </Badge>
                          <span className="truncate text-sm font-medium">
                            {tx.asset.symbol}
                            {tx.asset.name !== tx.asset.symbol && (
                              <span className="text-muted-foreground"> · {tx.asset.name}</span>
                            )}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {fmtDate(tx.occurredAt)} · {nameById.get(tx.portfolioId) ?? "—"}
                        </div>
                        <div className="mt-1 text-sm tabular-nums">
                          {fmtQty(parseFloat(tx.quantity))}
                          <span className="text-muted-foreground"> @ {fmtMoney(parseFloat(tx.price), tx.asset.currency)}</span>
                          <span className="text-xs text-muted-foreground">
                            {" · "}Fee {parseFloat(tx.fee) ? fmtMoney(parseFloat(tx.fee), tx.asset.currency) : "—"}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <TransactionDialog portfolios={portfolios} transaction={tx} />
                        <DeleteButton action={deleteTransactionAction.bind(null, tx.id)} />
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
