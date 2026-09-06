import { TransactionDialog } from "@/components/features/transaction-dialog";
import { TransactionLedger } from "@/components/features/transaction-ledger";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { getUserPortfolios, getUserTransactions } from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const userId = await requireUserId();
  const [txs, portfolios] = await Promise.all([
    getUserTransactions(userId),
    getUserPortfolios(userId),
  ]);
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
            <TransactionLedger transactions={ledger} portfolios={portfolios} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
