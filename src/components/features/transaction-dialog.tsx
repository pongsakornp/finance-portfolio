"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, PencilIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

import {
  createTransactionAction,
  updateTransactionAction,
} from "@/actions/transaction.actions";
import { searchCryptoAssetsAction, type CryptoOption } from "@/actions/crypto.actions";
import { searchFundsAction } from "@/actions/fund.actions";
import { searchStocksAction, type StockOption } from "@/actions/stock.actions";
import { Button } from "@/components/ui/button";
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
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
  FieldDescription,
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TxRow } from "@/lib/services/view-service";
import { padDecimals } from "@/lib/utils/money";

type Portfolio = { id: string; name: string };
type FundOption = { value: string; label: string };
type AssetChoice = "US" | "SET" | "crypto" | "commodity" | "mutualfund";

function assetChoiceFor(asset?: TxRow["asset"]): AssetChoice {
  if (!asset || asset.type === "stock" || asset.type === "etf") {
    return asset?.market === "SET" ? "SET" : "US";
  }
  return asset.type === "crypto" || asset.type === "commodity" || asset.type === "mutualfund"
    ? asset.type
    : "US";
}

function assetTypeFor(choice: AssetChoice, stock?: StockOption | null) {
  return choice === "US" || choice === "SET" ? stock?.assetType ?? "stock" : choice;
}

function marketFor(choice: AssetChoice): "US" | "SET" {
  return choice === "SET" || choice === "mutualfund" ? "SET" : "US";
}

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
  const [assetChoice, setAssetChoice] = useState<AssetChoice>(() => assetChoiceFor(transaction?.asset));
  const [txType, setTxType] = useState<"buy" | "sell">(transaction?.type ?? "buy");
  const [portfolioId, setPortfolioId] = useState(
    transaction?.portfolioId ?? defaultPortfolioId ?? portfolios[0]?.id
  );
  const [fundQuery, setFundQuery] = useState("");
  const [fundRows, setFundRows] = useState<FundOption[]>([]);
  const [fundValue, setFundValue] = useState<FundOption | null>(null);
  const [cryptoQuery, setCryptoQuery] = useState("");
  const [cryptoRows, setCryptoRows] = useState<CryptoOption[]>([]);
  const [cryptoValue, setCryptoValue] = useState<CryptoOption | null>(null);
  const [stockQuery, setStockQuery] = useState("");
  const [stockRows, setStockRows] = useState<StockOption[]>([]);
  const [stockValue, setStockValue] = useState<StockOption | null>(null);
  const assetType = assetTypeFor(assetChoice, stockValue);
  const market = marketFor(assetChoice);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  // fetch fund suggestions for the autocomplete (debounced)
  useEffect(() => {
    if (assetChoice !== "mutualfund" || !open) return;
    const t = setTimeout(() => {
      searchFundsAction(fundQuery).then(setFundRows).catch(() => setFundRows([]));
    }, 150);
    return () => clearTimeout(t);
  }, [assetChoice, fundQuery, open]);

  // CMC catalog suggestions are DB-backed; the service warms an empty catalog once.
  useEffect(() => {
    if (assetChoice !== "crypto" || !open) return;
    const t = setTimeout(() => {
      searchCryptoAssetsAction(cryptoQuery).then(setCryptoRows).catch(() => setCryptoRows([]));
    }, 150);
    return () => clearTimeout(t);
  }, [assetChoice, cryptoQuery, open]);

  // Yahoo handles both US and SET (including ETFs); SET suggestions are saved
  // without Yahoo's .BK suffix.
  useEffect(() => {
    if ((assetChoice !== "US" && assetChoice !== "SET") || !open) return;
    const t = setTimeout(() => {
      searchStocksAction(stockQuery, assetChoice).then(setStockRows).catch(() => setStockRows([]));
    }, 150);
    return () => clearTimeout(t);
  }, [assetChoice, open, stockQuery]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // reset to the transaction's (or add) values on every open
      setTxType(isEdit ? transaction.type : "buy");
      setPortfolioId(isEdit ? transaction.portfolioId : defaultPortfolioId ?? portfolios[0]?.id);
      setAssetChoice(isEdit ? assetChoiceFor(transaction.asset) : "US");
      setFundQuery("");
      setFundValue(
        isEdit && transaction.asset.type === "mutualfund"
          ? { value: transaction.asset.symbol, label: transaction.asset.name }
          : null
      );
      setCryptoQuery("");
      setCryptoValue(
        isEdit && transaction.asset.type === "crypto" && transaction.asset.externalId
          ? { value: transaction.asset.symbol, label: transaction.asset.name, cmcId: transaction.asset.externalId }
          : null
      );
      const isRegionalAsset = isEdit && (transaction.asset.type === "stock" || transaction.asset.type === "etf");
      setStockQuery(isRegionalAsset ? transaction.asset.symbol : "");
      setStockValue(
        isRegionalAsset
          ? {
              value: transaction.asset.symbol.replace(/\.BK$/i, ""),
              label: transaction.asset.nameEn ?? transaction.asset.name,
              assetType: transaction.asset.type === "etf" ? "etf" : "stock",
            }
          : null
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

  const trigger = isEdit ? (
    <Button variant="ghost" size="icon" aria-label="Edit transaction">
      <PencilIcon className="size-4" />
    </Button>
  ) : (
    <Button size="sm">
      <PlusIcon data-icon="inline-start" /> Add transaction
    </Button>
  );

  if (portfolios.length === 0) {
    return (
      <Button size="sm" variant="outline" disabled title="Create a portfolio first">
        Add transaction
      </Button>
    );
  }

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
                <input type="hidden" name="portfolioId" value={portfolioId} />
                <Select value={portfolioId} onValueChange={(v) => v && setPortfolioId(v)}>
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
                      {(v) => ({ buy: "Buy", sell: "Sell" }[String(v)] ?? v)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </FieldContent>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel className="text-muted-foreground">Asset</FieldLabel>
              <FieldContent>
                <input type="hidden" name="assetType" value={assetType} />
                <input type="hidden" name="market" value={market} />
                <ToggleGroup
                  aria-label="Asset"
                  className="w-full"
                  size="sm"
                  spacing={0}
                  value={[assetChoice]}
                  variant="outline"
                  onValueChange={(value) => {
                    const next = value[0];
                    if (
                      next === "US" ||
                      next === "SET" ||
                      next === "crypto" ||
                      next === "commodity" ||
                      next === "mutualfund"
                    ) {
                      setAssetChoice(next);
                      setStockQuery("");
                      setStockRows([]);
                      setStockValue(null);
                    }
                  }}
                >
                  <ToggleGroupItem className="flex-1" value="US">US</ToggleGroupItem>
                  <ToggleGroupItem className="flex-1" value="SET">Thailand</ToggleGroupItem>
                  <ToggleGroupItem className="flex-1" value="crypto">Crypto</ToggleGroupItem>
                  <ToggleGroupItem className="flex-1" value="commodity">Commodity</ToggleGroupItem>
                  <ToggleGroupItem className="flex-1" value="mutualfund">Fund</ToggleGroupItem>
                </ToggleGroup>
              </FieldContent>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel className="text-muted-foreground">Symbol</FieldLabel>
              <FieldContent>
                {assetType === "mutualfund" ? (
                  <Combobox
                    items={fundRows}
                    value={fundValue}
                    onValueChange={(v) => setFundValue(v as FundOption | null)}
                    onInputValueChange={(v) => setFundQuery(v)}
                    filter={null}
                    itemToStringValue={(it) => (it as FundOption).value}
                    itemToStringLabel={(it) => (it as FundOption).value}
                  >
                    <input type="hidden" name="symbol" value={fundValue?.value ?? ""} />
                    <ComboboxInput
                      placeholder="Search fund code or name…"
                      showClear
                      className="w-full"
                    />
                    <ComboboxContent className="w-[min(30rem,var(--available-width))] min-w-[min(30rem,var(--available-width))]">
                      <ComboboxList>
                        {fundRows.map((f) => (
                          <ComboboxItem key={f.value} value={f} className="flex-col items-start">
                            <span className="w-full whitespace-nowrap font-medium uppercase">{f.value}</span>
                            <span className="w-full truncate text-muted-foreground">{f.label}</span>
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                ) : assetType === "crypto" ? (
                  <Combobox
                    items={cryptoRows}
                    value={cryptoValue}
                    onValueChange={(v) => setCryptoValue(v as CryptoOption | null)}
                    onInputValueChange={(v) => setCryptoQuery(v)}
                    filter={null}
                    itemToStringValue={(it) => (it as CryptoOption).value}
                    itemToStringLabel={(it) => (it as CryptoOption).value}
                  >
                    <input type="hidden" name="symbol" value={cryptoValue?.value ?? ""} />
                    <input type="hidden" name="assetName" value={cryptoValue?.label ?? ""} />
                    <input type="hidden" name="assetNameEn" value={cryptoValue?.label ?? ""} />
                    <input type="hidden" name="externalId" value={cryptoValue?.cmcId ?? ""} />
                    <ComboboxInput
                      placeholder="Search crypto symbol or name…"
                      showClear
                      className="w-full"
                    />
                    <ComboboxContent className="w-[min(30rem,var(--available-width))] min-w-[min(30rem,var(--available-width))]">
                      <ComboboxList>
                        {cryptoRows.map((crypto) => (
                          <ComboboxItem key={crypto.cmcId} value={crypto} className="flex-col items-start">
                            <span className="w-full whitespace-nowrap font-medium uppercase">{crypto.value}</span>
                            <span className="w-full truncate text-muted-foreground">{crypto.label}</span>
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                ) : assetChoice === "US" || assetChoice === "SET" ? (
                  <Combobox
                    items={stockRows}
                    value={stockValue}
                    onValueChange={(v) => setStockValue(v as StockOption | null)}
                    onInputValueChange={(v) => {
                      setStockQuery(v);
                      if (stockValue && v.toUpperCase() !== stockValue.value) setStockValue(null);
                    }}
                    filter={null}
                    itemToStringValue={(it) => (it as StockOption).value}
                    itemToStringLabel={(it) => (it as StockOption).value}
                  >
                    <input type="hidden" name="symbol" value={stockValue?.value ?? stockQuery} />
                    <input type="hidden" name="assetName" value={stockValue?.label ?? ""} />
                    <input type="hidden" name="assetNameEn" value={stockValue?.label ?? ""} />
                    <ComboboxInput
                      placeholder={assetChoice === "SET" ? "Search SET symbol or English name…" : "Search US symbol or name…"}
                      showClear
                      className="w-full uppercase"
                    />
                    <ComboboxContent className="w-[min(30rem,var(--available-width))] min-w-[min(30rem,var(--available-width))]">
                      <ComboboxList>
                        {stockRows.map((stock) => (
                          <ComboboxItem key={stock.value} value={stock} className="flex-col items-start">
                            <span className="w-full whitespace-nowrap font-medium uppercase">{stock.value}</span>
                            <span className="w-full truncate text-muted-foreground">{stock.label}</span>
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                ) : (
                  <Input
                    name="symbol"
                    required
                    defaultValue={transaction?.asset.symbol}
                    placeholder="XAUUSD=X (gold), CL=F (oil)"
                    className="uppercase"
                  />
                )}
              </FieldContent>
              {assetType === "crypto" && (
                <FieldDescription>
                  Select an asset to save its verified CoinMarketCap ID automatically.
                </FieldDescription>
              )}
            </Field>

            <Field>
              <FieldLabel className="text-muted-foreground">Quantity</FieldLabel>
              <FieldContent>
                <Input name="quantity" type="number" step="any" min="0" required defaultValue={transaction?.quantity ?? "0"} />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel className="text-muted-foreground">Price / unit</FieldLabel>
              <FieldContent>
                <Input name="price" type="number" step="any" min="0" required defaultValue={padDecimals(transaction?.price)} />
              </FieldContent>
            </Field>
            <Field>
              <FieldLabel className="text-muted-foreground">Fee</FieldLabel>
              <FieldContent>
                <Input name="fee" type="number" step="any" min="0" defaultValue={padDecimals(transaction?.fee, 4)} />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel className="text-muted-foreground">Date</FieldLabel>
              <FieldContent>
                <DatePicker
                  name="occurredAt"
                  defaultValue={transaction ? new Date(transaction.occurredAt) : new Date()}
                />
              </FieldContent>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel className="text-muted-foreground">Note</FieldLabel>
              <FieldContent>
                <Input name="note" placeholder="Optional note" defaultValue={transaction?.note ?? ""} />
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
