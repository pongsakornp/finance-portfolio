"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { importTransactionsAction, type ImportRow } from "@/actions/transaction.actions";
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

const SAMPLES: ImportRow[] = [
  { symbol: "AAPL", assetType: "stock", type: "buy", quantity: 10, price: 150.25, fee: 1.99, occurredAt: "2025-06-01", currency: "USD", market: "US", note: "" },
  { symbol: "BTC", name: "Bitcoin", assetType: "crypto", type: "buy", quantity: 0.5, price: 60000, fee: 0, occurredAt: "2025-07-15", currency: "USD", market: "US" },
  { symbol: "XAUUSD=X", name: "Gold", assetType: "commodity", type: "buy", quantity: 1, price: 2400, fee: 0, occurredAt: "2025-08-01", currency: "USD", market: "US" },
  { symbol: "PTT.BK", assetType: "stock", type: "buy", quantity: 100, price: 40.5, fee: 5, occurredAt: "2025-08-20", currency: "THB", market: "SET" },
];

export function ImportClient({ portfolios }: { portfolios: Array<{ id: string; name: string }> }) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function parseFile(file: File) {
    setFileName(file.name);
    file.text().then((text) => {
      try {
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error("Expected an array of transactions");
        setRows(data as ImportRow[]);
      } catch (e) {
        toast.error(`Failed to parse JSON: ${e instanceof Error ? e.message : ""}`);
      }
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
    const blob = new Blob([JSON.stringify(SAMPLES, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions-template.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="json">Upload JSON</Label>
        <label
          htmlFor="json"
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <span className="font-medium text-foreground">{fileName || "Choose a JSON file"}</span>
        </label>
        <input
          id="json"
          ref={fileRef}
          type="file"
          accept=".json,application/json"
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
