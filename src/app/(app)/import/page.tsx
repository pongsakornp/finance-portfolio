import { ImportClient } from "@/components/features/import-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserPortfolios } from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const userId = await requireUserId();
  const portfolios = await getUserPortfolios(userId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Import transactions</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV import</CardTitle>
          <CardDescription>
            Columns: symbol, name (optional), asset_type (stock|etf|crypto|commodity|cash|mutualfund), type
            (buy|sell|dividend), quantity, price, fee, date (YYYY-MM-DD)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portfolios.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Create a portfolio first.
            </p>
          ) : (
            <ImportClient portfolios={portfolios.map((p) => ({ id: p.id, name: p.name }))} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
