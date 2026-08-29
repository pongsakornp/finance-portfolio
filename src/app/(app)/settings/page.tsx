import { desc, eq } from "drizzle-orm";

import { ApiKeysCard } from "@/components/features/api-keys-card";
import { CurrencySwitcher } from "@/components/currency-switcher";
import { ImportClient } from "@/components/features/import-client";
import { PlViewSetting } from "@/components/features/pl-view-setting";
import { ThemeSetting } from "@/components/features/theme-setting";
import { db } from "@/lib/db";
import { apiKeys, users } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";
import { getUserPortfolios } from "@/lib/services/view-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { DownloadIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const userId = await requireUserId();
  const [keys, portfolios, [userRow]] = await Promise.all([
    db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.userId, userId))
      .orderBy(desc(apiKeys.createdAt)),
    getUserPortfolios(userId),
    db
      .select({ baseCurrency: users.baseCurrency, plView: users.plView })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>
            Display currency and theme.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Display currency</div>
            <CurrencySwitcher
              value={userRow?.baseCurrency ?? "USD"}
              triggerClassName="w-full"
            />
          </div>
          <div className="space-y-2 border-t pt-6">
            <div className="text-sm font-medium">Theme</div>
            <ThemeSetting />
          </div>
          <div className="space-y-2 border-t pt-6">
            <div className="text-sm font-medium">P/L basis in holdings</div>
            <PlViewSetting value={userRow?.plView ?? "unrealized"} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import / Export</CardTitle>
          <CardDescription>
            Import transactions from CSV, or export all transactions to CSV.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-medium">Export CSV</div>
            <Button variant="outline" render={<a href="/api/export" download />}>
              <DownloadIcon className="h-4 w-4" />
              Download transactions
            </Button>
          </div>
          <div className="space-y-2 border-t pt-6">
            {portfolios.length === 0 ? (
              <Empty className="p-8">
                <EmptyDescription>Create a portfolio first.</EmptyDescription>
              </Empty>
            ) : (
              <ImportClient
                portfolios={portfolios.map((p) => ({ id: p.id, name: p.name }))}
              />
            )}
          </div>
        </CardContent>
      </Card>
      <ApiKeysCard
        keys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revoked: k.revokedAt !== null,
        }))}
      />
    </div>
  );
}
