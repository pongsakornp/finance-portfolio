import { redirect } from "next/navigation";

import { AddPortfolioDialog } from "@/components/features/add-portfolio-dialog";
import { getUserPortfolios } from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PortfoliosPage() {
  const userId = await requireUserId();
  const portfolios = await getUserPortfolios(userId);

  if (portfolios.length > 0) {
    redirect(`/portfolios/${portfolios[0].id}`);
  }

  return (
    <div className="flex flex-col items-center gap-6 rounded-3xl border px-6 py-20 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to Portfolio</h1>
      <p className="max-w-sm text-muted-foreground">
        Create a portfolio to start tracking stocks, ETFs, and crypto in one place.
      </p>
      <AddPortfolioDialog />
    </div>
  );
}
