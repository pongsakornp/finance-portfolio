import Link from "next/link";

import { AddPortfolioDialog } from "@/components/features/add-portfolio-dialog";
import { DeleteButton } from "@/components/features/delete-button";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { deletePortfolioAction } from "@/actions/portfolio.actions";
import { getUserPortfolios, getUserTransactions } from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";
import { fmtDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  const userId = await requireUserId();
  const [portfolios, allTxs] = await Promise.all([
    getUserPortfolios(userId),
    getUserTransactions(userId),
  ]);

  const counts = new Map<string, { n: number; latest: Date | null }>();
  for (const tx of allTxs) {
    const c = counts.get(tx.portfolioId) ?? { n: 0, latest: null };
    c.n++;
    if (!c.latest || tx.occurredAt > c.latest) c.latest = tx.occurredAt;
    counts.set(tx.portfolioId, c);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Portfolios</h1>
        <AddPortfolioDialog />
      </div>

      {portfolios.length === 0 ? (
        <Empty className="p-12">
          <EmptyDescription>
            No portfolios yet — create one to start tracking.
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {portfolios.map((p) => {
            const stat = counts.get(p.id);
            return (
              <Card key={p.id} className="group relative">
                <Link
                  href={`/portfolios/${p.id}`}
                  className="absolute inset-0 z-10"
                  aria-label={p.name}
                />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-medium">{p.name}</h2>
                    <div className="relative z-20 opacity-100 transition-opacity md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
                      <DeleteButton
                        action={deletePortfolioAction.bind(null, p.id)}
                        confirmText={`Delete "${p.name}" and all its transactions?`}
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {stat?.n ?? 0} transactions
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stat?.latest ? `Last activity ${fmtDate(stat.latest)}` : "No activity yet"}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
