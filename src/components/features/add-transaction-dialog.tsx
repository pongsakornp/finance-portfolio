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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon /> Add transaction
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <form ref={formRef} action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add transaction</DialogTitle>
            <DialogDescription>
              Unknown symbols are created automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label>Portfolio</Label>
              <input type="hidden" name="portfolioId" value={defaultPortfolioId ?? portfolios[0].id} />
              <Select
                name="portfolioPicker"
                defaultValue={defaultPortfolioId ?? String(portfolios[0].id)}
                onValueChange={(v) => {
                  const hidden = formRef.current?.elements.namedItem("portfolioId") as HTMLInputElement;
                  if (hidden) hidden.value = v;
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Portfolio" />
                </SelectTrigger>
                <SelectContent>
                  {portfolios.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <input type="hidden" name="type" value={txType} />
              <Select defaultValue="buy" onValueChange={setTxType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="buy">Buy</SelectItem>
                  <SelectItem value="sell">Sell</SelectItem>
                  <SelectItem value="dividend">Dividend</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Asset class</Label>
              <input type="hidden" name="assetType" value={assetType} />
              <Select defaultValue="stock" onValueChange={setAssetType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="etf">ETF</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Symbol</Label>
              <Input
                name="symbol"
                required
                placeholder={assetType === "crypto" ? "BTC" : "AAPL / PTT.BK"}
                className="uppercase"
              />
            </div>

            {assetType === "crypto" && (
              <div className="space-y-1.5">
                <Label>CoinGecko ID</Label>
                <Input name="externalId" placeholder="bitcoin (optional)" />
              </div>
            )}

            {txType === "dividend" ? (
              <div className="space-y-1.5">
                <Label>Cash amount</Label>
                <Input name="quantity" type="number" step="any" min="0" required />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <Input name="quantity" type="number" step="any" min="0" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Price / unit</Label>
                  <Input name="price" type="number" step="any" min="0" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Fee</Label>
                  <Input name="fee" type="number" step="any" min="0" defaultValue={0} />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                name="occurredAt"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </div>
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
