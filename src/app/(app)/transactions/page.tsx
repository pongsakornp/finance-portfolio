import { AddTransactionDialog } from "@/components/features/add-transaction-dialog";
import { DeleteButton } from "@/components/features/delete-button";
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <div className="flex gap-2">
          <a href="/api/export" download>
            <Badge variant="outline">Export CSV</Badge>
          </a>
          <AddTransactionDialog portfolios={portfolios} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All portfolios ({ledger.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet.
            </p>
          ) : (
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
                    <TableCell className="font-medium">{tx.asset.symbol}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tx.type === "dividend"
                        ? fmtMoney(parseFloat(tx.quantity), tx.asset.currency)
                        : fmtQty(parseFloat(tx.quantity))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {tx.type === "dividend" ? "—" : fmtMoney(parseFloat(tx.price), tx.asset.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {parseFloat(tx.fee) ? fmtMoney(parseFloat(tx.fee), tx.asset.currency) : "—"}
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
