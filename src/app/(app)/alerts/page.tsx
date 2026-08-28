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
import { Empty, EmptyDescription } from "@/components/ui/empty";
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
    <div className="flex flex-col gap-6">
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
            <Empty className="p-8">
              <EmptyDescription>No alerts configured.</EmptyDescription>
            </Empty>
          ) : (
            <>
              <div className="hidden md:block">
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
              </div>
              <div className="md:hidden">
                <div className="divide-y">
                  {withQuotes.map(({ alert, asset, price }) => {
                    const hit =
                      price !== null &&
                      (alert.direction === "above"
                        ? price >= parseFloat(alert.threshold)
                        : price <= parseFloat(alert.threshold));
                    const status = alert.triggeredAt ? (
                      <Badge variant="warning" title={fmtDate(alert.triggeredAt)}>
                        Triggered {fmtDate(alert.triggeredAt)}
                      </Badge>
                    ) : !alert.active ? (
                      <Badge variant="secondary">Paused</Badge>
                    ) : hit ? (
                      <Badge variant="success">Condition met</Badge>
                    ) : (
                      <Badge variant="outline">Watching</Badge>
                    );
                    return (
                      <div key={alert.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{asset.symbol}</span>
                          <div className="flex items-center gap-1">
                            <ToggleAlertButton
                              action={toggleAlertActive.bind(null, alert.id, !alert.active)}
                              active={alert.active}
                            />
                            <DeleteButton action={deleteAlertAction.bind(null, alert.id)} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {alert.direction === "above" ? "≥" : "≤"}{" "}
                            {fmtMoney(parseFloat(alert.threshold), asset.currency)}
                          </span>
                          <span className="tabular-nums">
                            {price === null ? "—" : fmtMoney(price, asset.currency)}
                          </span>
                        </div>
                        <div>{status}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// silence unused import warning for `and` if lint flags it
