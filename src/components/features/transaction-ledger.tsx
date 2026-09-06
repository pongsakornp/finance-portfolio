import { deleteTransactionAction } from "@/actions/transaction.actions";
import { DeleteButton } from "@/components/features/delete-button";
import { TransactionDialog } from "@/components/features/transaction-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { TxRow } from "@/lib/services/view-service";
import { fmtDate } from "@/lib/utils/date";
import { fmtMoney, fmtQty } from "@/lib/utils/money";

type PortfolioOption = { id: string; name: string };

type TransactionLedgerProps = {
  transactions: TxRow[];
  portfolios: PortfolioOption[];
  showPortfolio?: boolean;
  showFee?: boolean;
};

/** Responsive transaction rows shared by the all-portfolios and portfolio-detail views. */
export function TransactionLedger({
  transactions,
  portfolios,
  showPortfolio = true,
  showFee = true,
}: TransactionLedgerProps) {
  const nameById = new Map(portfolios.map((portfolio) => [portfolio.id, portfolio.name]));

  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              {showPortfolio && <TableHead>Portfolio</TableHead>}
              <TableHead>Action</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead className="text-right">Qty / Amount</TableHead>
              <TableHead className="text-right">Price</TableHead>
              {showFee && <TableHead className="text-right">Fee</TableHead>}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell>{fmtDate(tx.occurredAt)}</TableCell>
                {showPortfolio && (
                  <TableCell className="text-muted-foreground">
                    {nameById.get(tx.portfolioId) ?? "—"}
                  </TableCell>
                )}
                <TableCell>
                  <Badge variant={tx.type === "buy" ? "default" : "warning"} className="capitalize">
                    {tx.type}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {tx.asset.name !== tx.asset.symbol && (
                    <span className="mr-1.5 text-xs font-normal text-muted-foreground">
                      {tx.asset.symbol}
                    </span>
                  )}
                  {tx.asset.name}
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmtQty(parseFloat(tx.quantity))}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {fmtMoney(parseFloat(tx.price), tx.asset.currency)}
                </TableCell>
                {showFee && (
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {parseFloat(tx.fee) ? fmtMoney(parseFloat(tx.fee), tx.asset.currency) : "—"}
                  </TableCell>
                )}
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
        {transactions.map((tx) => (
          <li key={tx.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant={tx.type === "buy" ? "default" : "warning"} className="capitalize">
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
                  {fmtDate(tx.occurredAt)}
                  {showPortfolio && ` · ${nameById.get(tx.portfolioId) ?? "—"}`}
                </div>
                <div className="mt-1 text-sm tabular-nums">
                  {fmtQty(parseFloat(tx.quantity))}
                  <span className="text-muted-foreground"> @ {fmtMoney(parseFloat(tx.price), tx.asset.currency)}</span>
                  {showFee && (
                    <span className="text-xs text-muted-foreground">
                      {" · "}Fee {parseFloat(tx.fee) ? fmtMoney(parseFloat(tx.fee), tx.asset.currency) : "—"}
                    </span>
                  )}
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
  );
}
