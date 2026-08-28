import {
  Card,
  CardContent,
  CardDescription,
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
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { monthlyBreakdown, type TxForReport } from "@/lib/services/report-service";
import { getUserTransactions } from "@/lib/services/view-service";
import { getRate } from "@/lib/services/fx-service";
import { requireUserId } from "@/lib/session";
import { fmtMoney } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const userId = await requireUserId();
  const [[user], txs] = await Promise.all([
    db.select({ baseCurrency: users.baseCurrency }).from(users).where(eq(users.id, userId)),
    getUserTransactions(userId),
  ]);
  const baseCurrency = user?.baseCurrency ?? "USD";

  // report is computed in USD space (assets are normalized there), then displayed
  const rate =
    baseCurrency === "USD" ? 1 : (await getRate("USD", baseCurrency)).toNumber();
  const money = (usd: number) => fmtMoney(usd * rate, baseCurrency);

  // portfolio-level monthly view: transactions already carry native currency;
  // convert each row to USD first so aggregation is consistent
  const usdTxs: TxForReport[] = [];
  const ratesCache = new Map<string, number>();
  for (const tx of txs) {
    if (tx.asset.currency === "USD") {
      usdTxs.push(tx);
      continue;
    }
    let r = ratesCache.get(tx.asset.currency);
    if (r === undefined) {
      r = (await getRate(tx.asset.currency, "USD")).toNumber();
      ratesCache.set(tx.asset.currency, r);
    }
    const q = parseFloat(tx.quantity);
    const p = parseFloat(tx.price);
    usdTxs.push({
      ...tx,
      // dividends: quantity IS the cash amount → convert it; buy/sell: convert price+fee
      quantity: tx.type === "dividend" ? String(q * r) : String(q),
      price: String(p * r),
      fee: String(parseFloat(tx.fee) * r),
    });
  }

  const rows = monthlyBreakdown(usdTxs);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Monthly reports</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash flow by month ({baseCurrency})</CardTitle>
          <CardDescription>
            Invested vs proceeds, realized dividends and fees paid. Realized P/L per
            month appears in the Transactions ledger.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <Empty className="p-8">
              <EmptyDescription>No data yet.</EmptyDescription>
            </Empty>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Invested</TableHead>
                      <TableHead className="text-right">Sold proceeds</TableHead>
                      <TableHead className="text-right">Dividends</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.month}>
                        <TableCell className="font-medium">{r.month}</TableCell>
                        <TableCell className="text-right tabular-nums">{money(r.invested)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.soldProceeds ? money(r.soldProceeds) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.dividends ? money(r.dividends) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {r.fees ? money(r.fees) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="md:hidden">
                <div className="divide-y">
                  {rows.map((r) => (
                    <div key={r.month} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                      <span className="font-medium">{r.month}</span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <span className="text-muted-foreground">Invested</span>
                        <span className="tabular-nums text-right">{money(r.invested)}</span>
                        <span className="text-muted-foreground">Sold proceeds</span>
                        <span className="tabular-nums text-right">{r.soldProceeds ? money(r.soldProceeds) : "—"}</span>
                        <span className="text-muted-foreground">Dividends</span>
                        <span className="tabular-nums text-right">{r.dividends ? money(r.dividends) : "—"}</span>
                        <span className="text-muted-foreground">Fees</span>
                        <span className="tabular-nums text-right">{r.fees ? money(r.fees) : "—"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
