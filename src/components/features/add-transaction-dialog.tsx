"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createTransactionAction } from "@/actions/transaction.actions";
import { Button } from "@/components/ui/button";
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

type Portfolio = { id: string; name: string };

export function AddTransactionDialog({
  portfolios,
  defaultPortfolioId,
}: {
  portfolios: Portfolio[];
  defaultPortfolioId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [assetType, setAssetType] = useState("stock");
  const [cashCurrency, setCashCurrency] = useState("USD");
  const [txType, setTxType] = useState("buy");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await createTransactionAction(fd);
      { if (res?.error) { toast.error(res.error); return; } }
      toast.success("Transaction saved");
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon data-icon="inline-start" /> Add transaction
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto p-4 sm:p-6">
        <form ref={formRef} action={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add transaction</DialogTitle>
            <DialogDescription>
              Unknown symbols are created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel>Portfolio</FieldLabel>
              <FieldContent>
                <input type="hidden" name="portfolioId" value={defaultPortfolioId ?? portfolios[0].id} />
                <Select
                  name="portfolioPicker"
                  defaultValue={defaultPortfolioId ?? String(portfolios[0].id)}
                  onValueChange={(v) => {
                    if (!v) return;
                    const hidden = formRef.current?.elements.namedItem("portfolioId") as HTMLInputElement;
                    if (hidden) hidden.value = v;
                  }}
                >
                  <SelectTrigger>
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
              <FieldLabel>Type</FieldLabel>
              <FieldContent>
                <input type="hidden" name="type" value={txType} />
                <Select defaultValue="buy" onValueChange={(v) => v && setTxType(v)}>
                  <SelectTrigger>
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
              <FieldLabel>Asset class</FieldLabel>
              <FieldContent>
                <input type="hidden" name="assetType" value={assetType} />
                <Select defaultValue="stock" onValueChange={(v) => v && setAssetType(v)}>
                  <SelectTrigger>
                    <SelectValue>
                      {(v) =>
                        ({
                          stock: "Stock",
                          etf: "ETF",
                          crypto: "Crypto",
                          commodity: "Commodity",
                          cash: "Cash",
                          mutualfund: "Mutual Fund (TH)",
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
                    <SelectItem value="mutualfund">Mutual Fund (TH)</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Symbol</FieldLabel>
              <FieldContent>
                <Input
                  name="symbol"
                  required
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

            {assetType === "cash" && (
              <Field>
                <FieldLabel>Currency</FieldLabel>
                <FieldContent>
                  <input type="hidden" name="assetCurrency" value={cashCurrency} />
                  <Select defaultValue={cashCurrency} onValueChange={(v) => v && setCashCurrency(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="THB">THB</SelectItem>
                    </SelectContent>
                  </Select>
                </FieldContent>
              </Field>
            )}

            {assetType === "crypto" && (
              <Field>
                <FieldLabel>CoinGecko ID</FieldLabel>
                <FieldContent>
                  <Input name="externalId" placeholder="bitcoin (optional)" />
                </FieldContent>
              </Field>
            )}

            {txType === "dividend" ? (
              <Field>
                <FieldLabel>Cash amount</FieldLabel>
                <FieldContent>
                  <Input name="quantity" type="number" step="any" min="0" required />
                </FieldContent>
              </Field>
            ) : assetType === "cash" ? (
              <>
                {/* cash is priced at exactly 1 unit of its own currency */}
                <input type="hidden" name="price" value="1" />
                <Field>
                  <FieldLabel>Amount</FieldLabel>
                  <FieldContent>
                    <Input name="quantity" type="number" step="any" min="0" required />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Fee</FieldLabel>
                  <FieldContent>
                    <Input name="fee" type="number" step="any" min="0" defaultValue={0} />
                  </FieldContent>
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel>Quantity</FieldLabel>
                  <FieldContent>
                    <Input name="quantity" type="number" step="any" min="0" required />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Price / unit</FieldLabel>
                  <FieldContent>
                    <Input name="price" type="number" step="any" min="0" required />
                  </FieldContent>
                </Field>
                <Field>
                  <FieldLabel>Fee</FieldLabel>
                  <FieldContent>
                    <Input name="fee" type="number" step="any" min="0" defaultValue={0} />
                  </FieldContent>
                </Field>
              </>
            )}

            <Field>
              <FieldLabel>Date</FieldLabel>
              <FieldContent>
                <Input
                  name="occurredAt"
                  type="date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </FieldContent>
            </Field>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
