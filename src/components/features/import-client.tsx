"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";

import { importTransactionsAction } from "@/actions/transaction.actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
          const t = (r.type ?? "").toLowerCase().trim();
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
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="csv">Upload CSV</Label>
        <input
          id="csv"
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && parseFile(e.target.files[0])}
        />
        <button onClick={downloadTemplate} className="block text-xs text-muted-foreground underline underline-offset-4">
          Download template
        </button>
      </div>

      {rows.length > 0 && (
        <>
          <div className="max-w-sm space-y-1.5">
            <Label>Import into</Label>
            <Select value={portfolioId} onValueChange={setPortfolioId}>
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

          <div className="rounded-md border">
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
            {rows.length > 20 && (
              <p className="border-t p-2 text-xs text-muted-foreground">
                …and {rows.length - 20} more
              </p>
            )}
          </div>

          <Button onClick={runImport} disabled={pending}>
            {pending ? "Importing…" : `Import ${rows.length} rows from ${fileName}`}
          </Button>
        </>
      )}
    </div>
  );
}
