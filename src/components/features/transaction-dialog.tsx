"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  createTransactionAction,
  updateTransactionAction,
} from "@/actions/transaction.actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/features/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TxRow } from "@/lib/services/view-service";

type Portfolio = { id: string; name: string };

export function TransactionDialog({
  portfolios,
  transaction,
  defaultPortfolioId,
}: {
  portfolios: Portfolio[];
  transaction?: TxRow;
  defaultPortfolioId?: string;
}) {
  const isEdit = !!transaction;
  const [open, setOpen] = useState(false);
  const [assetType, setAssetType] = useState(transaction?.asset.type ?? "stock");
  const [cashCurrency, setCashCurrency] = useState(
    transaction && transaction.asset.type === "cash" ? transaction.asset.currency : "USD"
  );
  const [txType, setTxType] = useState<"buy" | "sell" | "dividend">(transaction?.type ?? "buy");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // reset to the transaction's (or add) values on every open
      setTxType(isEdit ? transaction.type : "buy");
      setAssetType(isEdit ? transaction.asset.type : "stock");
      setCashCurrency(
        isEdit && transaction.asset.type === "cash" ? transaction.asset.currency : "USD"
      );
    }
  }

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = isEdit
        ? await updateTransactionAction(transaction.id, fd)
        : await createTransactionAction(fd);
      { if (res?.error) { toast.error(res.error); return; } }
      toast.success(isEdit ? "Transaction updated" : "Transaction saved");
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    });
  }

  if (portfolios.length === 0) {
    return (
      <Button size="sm" variant="outline" disabled title="Create a portfolio first">
        Add transaction
      </Button>
    );
  }

  const trigger = isEdit ? (
    <Button variant="ghost" size="icon" aria-label="Edit transaction">
      <PencilIcon className="size-4" />
    </Button>
  ) : (
    <Button size="sm">
      <PlusIcon data-icon="inline-start" /> Add transaction
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto p-4 sm:p-6">
        <form ref={formRef} action={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit transaction" : "Add transaction"}</DialogTitle>
            <DialogDescription>
              Unknown symbols are created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel className="text-muted-foreground">Portfolio</FieldLabel>
              <FieldContent>
                <input
                  type="hidden"
                  name="portfolioId"
                  defaultValue={transaction?.portfolioId ?? defaultPortfolioId ?? portfolios[0].id}
                />
                <Select
                  name="portfolioPicker"
                  defaultValue={transaction?.portfolioId ?? defaultPortfolioId ?? String(portfolios[0].id)}
                  onValueChange={(v) => {
                    if (!v) return;
                    const hidden = formRef.current?.elements.namedItem("portfolioId") as HTMLInputElement;
                    if (hidden) hidden.value = v;
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Portfolio">
                      {(v) => portfolios.find((p) => p.id === v)?.name ?? "Select"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {portfolios.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel className="text-muted-foreground">Type</FieldLabel>
              <FieldContent>
                <input type="hidden" name="type" value={txType} />
                <Select defaultValue={transaction?.type ?? "buy"} onValueChange={(v) => v && setTxType(v as typeof txType)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v) => ({ buy: "Buy", sell: "Sell", dividend: "Dividend" }[String(v)] ?? v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                    <SelectItem value="dividend">Dividend</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel className="text-muted-foreground">Asset class</FieldLabel>
              <FieldContent>
                <input type="hidden" name="assetType" value={assetType} />
                <Select defaultValue={transaction?.asset.type ?? "stock"} onValueChange={(v) => v && setAssetType(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(v) =>
                        ({
                          stock: "Stock",
                          etf: "ETF",
                          crypto: "Crypto",
                          commodity: "Commodity",
                          cash: "Cash",
                          mutualfund: "Fund",
                        }[String(v)] ?? v)
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stock">Stock</SelectItem>
                    <SelectItem value="etf">ETF</SelectItem>
                    <SelectItem value="crypto">Crypto</SelectItem>
                    <SelectItem value="commodity">Commodity</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mutualfund">Fund</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel className="text-muted-foreground">Symbol</FieldLabel>
              <FieldContent>
                <Input
                  name="symbol"
                  required
                  defaultValue={transaction?.asset.symbol}
                  placeholder={
                    assetType === "crypto"
                      ? "BTC"
                      : assetType === "commodity"
                        ? "XAUUSD=X (gold), CL=F (oil)"
                        : assetType === "cash"
                          ? "USD"
                          : assetType === "mutualfund"
                            ? "B-EQUITY (Finnomena code)"
                            : "AAPL / PTT.BK / TDEX.BK"
                  }
                  className="uppercase"
                />
              </FieldContent>
            </Field>

            {txType === "dividend" ? (
              <Field>
                <FieldLabel className="text-muted-foreground">Cash amount</FieldLabel>
                <FieldContent>
                  <Input name="quantity" type="number" step="any" min="0" required defaultValue={transaction?.quantity} />
                </FieldContent>
              </Field>
            ) : assetType === "cash" ? (
              <Field>
                <FieldLabel className="text-muted-foreground">Currency</FieldLabel>
                <FieldContent>
                  <input type="hidden" name="assetCurrency" value={cashCurrency} />
                  <Select defaultValue={cashCurrency} onValueChange={(v) => v && setCashCurrency(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="THB">THB</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            ) : (
              <Field>
                <FieldLabel className="text-muted-foreground">Quantity</FieldLabel>
                <FieldContent>
                  <Input name="quantity" type="number" step="any" min="0" required defaultValue={transaction?.quantity} />
                </FieldContent>
              </Field>
            )}

            {txType === "dividend" ? null : assetType === "cash" ? (
              <>
                {/* cash is priced at exactly 1 unit of its own currency */}
                <input type="hidden" name="price" value="1" />
                <Field>
                  <FieldLabel className="text-muted-foreground">Amount</FieldLabel>
                  <FieldContent>
                    <Input name="quantity" type="number" step="any" min="0" required defaultValue={transaction?.quantity} />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel className="text-muted-foreground">Fee</FieldLabel>
                  <FieldContent>
                    <Input name="fee" type="number" step="any" min="0" defaultValue={transaction?.fee ?? 0} />
                  </FieldContent>
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel className="text-muted-foreground">Price / unit</FieldLabel>
                  <FieldContent>
                    <Input name="price" type="number" step="any" min="0" required defaultValue={transaction?.price} />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel className="text-muted-foreground">Fee</FieldLabel>
                  <FieldContent>
                    <Input name="fee" type="number" step="any" min="0" defaultValue={transaction?.fee ?? 0} />
                  </FieldContent>
                </Field>
              </>
            )}

            {assetType === "crypto" && txType !== "dividend" && (
              <Field className="sm:col-span-2">
                <FieldLabel className="text-muted-foreground">CoinGecko ID</FieldLabel>
                <FieldContent>
                  <Input name="externalId" placeholder="bitcoin (optional)" defaultValue={transaction?.asset.externalId ?? ""} />
                </FieldContent>
              </Field>
            )}

            <Field className="sm:col-span-2">
              <FieldLabel className="text-muted-foreground">Note</FieldLabel>
              <FieldContent>
                <Input name="note" placeholder="Optional note" defaultValue={transaction?.note ?? ""} />
              </FieldContent>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel className="text-muted-foreground">Date</FieldLabel>
              <FieldContent>
                <DatePicker
                  name="occurredAt"
                  defaultValue={transaction ? new Date(transaction.occurredAt) : new Date()}
                />
              </FieldContent>
            </Field>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <LoaderCircleIcon data-icon="inline-start" className="animate-spin" />}
              {isEdit ? "Save changes" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
