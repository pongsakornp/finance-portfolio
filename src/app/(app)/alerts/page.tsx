import { eq } from "drizzle-orm";

import { AlertCreateForm } from "@/components/features/alert-create-form";
import { DeleteButton } from "@/components/features/delete-button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
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
import { deleteAlertAction, toggleAlertActive } from "@/actions/alert.actions";
import { ToggleAlertButton } from "@/components/features/toggle-alert-button";
import { db } from "@/lib/db";
import { alerts, assets } from "@/lib/db/schema";
import { getQuote } from "@/lib/services/quote-service";
import { requireUserId } from "@/lib/session";
import { fmtDate } from "@/lib/utils/date";
import { fmtMoney } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const userId = await requireUserId();
  const rows = await db
    .select({ alert: alerts, asset: assets })
    .from(alerts)
    .innerJoin(assets, eq(assets.id, alerts.assetId))
    .where(eq(alerts.userId, userId));

  const withQuotes = await Promise.all(
    rows.map(async ({ alert, asset }) => {
      try {
        const q = await getQuote(asset);
        return { alert, asset, price: q.price };
      } catch {
        return { alert, asset, price: null };
      }
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Price alerts</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New alert</CardTitle>
          <CardDescription>
            Checked hourly by the scheduler; triggered alerts stay marked until re-armed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertCreateForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Alerts ({withQuotes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {withQuotes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No alerts configured.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {withQuotes.map(({ alert, asset, price }) => {
                  const hit =
                    price !== null &&
                    (alert.direction === "above"
                      ? price >= parseFloat(alert.threshold)
                      : price <= parseFloat(alert.threshold));
                  return (
                    <TableRow key={alert.id}>
                      <TableCell className="font-medium">{asset.symbol}</TableCell>
                      <TableCell>
                        {alert.direction === "above" ? "≥" : "≤"}{" "}
                        {fmtMoney(parseFloat(alert.threshold), asset.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {price === null
                          ? "—"
                          : fmtMoney(price, asset.currency)}
                      </TableCell>
                      <TableCell>
                        {alert.triggeredAt ? (
                          <Badge variant="warning" title={fmtDate(alert.triggeredAt)}>
                            Triggered {fmtDate(alert.triggeredAt)}
                          </Badge>
                        ) : !alert.active ? (
                          <Badge variant="secondary">Paused</Badge>
                        ) : hit ? (
                          <Badge variant="success">Condition met</Badge>
                        ) : (
                          <Badge variant="outline">Watching</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <ToggleAlertButton
                            action={toggleAlertActive.bind(null, alert.id, !alert.active)}
                            active={alert.active}
                          />
                          <DeleteButton action={deleteAlertAction.bind(null, alert.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// silence unused import warning for `and` if lint flags it
