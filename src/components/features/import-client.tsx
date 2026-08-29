"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";

import { importTransactionsAction } from "@/actions/transaction.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ParsedRow = {
  symbol: string;
  name?: string;
  assetType: "stock" | "etf" | "crypto" | "commodity" | "cash";
  type: "buy" | "sell" | "dividend";
  quantity: number;
  price: number;
  fee: number;
  occurredAt: string;
  currency?: string; // cash only
};

const TEMPLATE = `symbol,name,asset_type,type,quantity,price,fee,date,currency
AAPL,,stock,buy,10,150.25,1.99,2025-06-01,
BTC,Bitcoin,crypto,buy,0.5,60000,0,2025-07-15,
XAUUSD=X,Gold,commodity,buy,1,2400,0,2025-08-01,
USD,Cash (USD),cash,buy,5000,1,0,2025-08-10,USD
THB,Cash (THB),cash,buy,150000,1,0,2025-08-10,THB
PTT.BK,,stock,dividend,500,0,0,2025-08-20,`;

export function ImportClient({ portfolios }: { portfolios: Array<{ id: string; name: string }> }) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function parseFile(file: File) {
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: ParsedRow[] = [];
        for (const r of result.data) {
          const at = (r.asset_type ?? r.assetType ?? "").toLowerCase().trim();
          if (!r.symbol || !at) continue;
          const t = (r.type ?? r.action ?? "").toLowerCase().trim();
          if (!["buy", "sell", "dividend"].includes(t)) continue;
          parsed.push({
            symbol: r.symbol.trim().toUpperCase(),
            name: r.name?.trim() || undefined,
            assetType: at as ParsedRow["assetType"],
            type: t as ParsedRow["type"],
            quantity: parseFloat(r.quantity),
            price: parseFloat(r.price ?? "0") || 0,
            fee: parseFloat(r.fee ?? "0") || 0,
            occurredAt: (r.date ?? r.occurred_at ?? "").trim(),
            currency: r.currency?.trim().toUpperCase() || undefined,
          });
        }
        setRows(parsed.filter((p) => !isNaN(p.quantity)));
      },
      error: () => toast.error("Failed to read CSV"),
    });
  }

  function runImport() {
    startTransition(async () => {
      const res = await importTransactionsAction(rows, portfolioId);
      toast.success(`Imported ${res.imported} transactions`);
      res.errors.slice(0, 3).forEach((e) => toast.warning(e));
      setRows([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="csv">Upload CSV</Label>
        <label
          htmlFor="csv"
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="font-medium text-foreground">{fileName || "Choose a CSV file"}</span>
        </label>
        <input
          id="csv"
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
        />
        <Button type="button" variant="link" size="sm" onClick={downloadTemplate} className="justify-start px-0">
          Download template
        </Button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="max-w-sm flex flex-col gap-1.5">
            <Label>Import into</Label>
            <Select value={portfolioId} onValueChange={(v) => v && setPortfolioId(v)}>
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
          </div>

          <div className="rounded-md border">
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Qty / Amount</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 20).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{r.symbol}</TableCell>
                      <TableCell>{r.assetType}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>{r.quantity}</TableCell>
                      <TableCell>{r.price}</TableCell>
                      <TableCell>{r.occurredAt}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="md:hidden">
              <div className="divide-y">
                {rows.slice(0, 20).map((r, i) => (
                  <div key={i} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{r.symbol}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {r.assetType} · {r.type} · {r.occurredAt}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="tabular-nums">{r.quantity}</span>
                      {r.price ? <span className="tabular-nums"> @ {r.price}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {rows.length > 20 && (
              <>
                <Separator />
                <p className="p-2 text-xs text-muted-foreground">
                  …and {rows.length - 20} more
                </p>
              </>
            )}
          </div>

          <Button onClick={runImport} disabled={pending} className="w-full sm:w-auto">
            {pending ? "Importing…" : `Import ${rows.length} rows`}
          </Button>
        </>
      )}
    </div>
  );
}
