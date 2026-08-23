"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createAlertAction } from "@/actions/alert.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AlertCreateForm() {
  const [assetType, setAssetType] = useState("crypto");
  const [direction, setDirection] = useState("above");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await createAlertAction(fd);
      { if (res?.error) { toast.error(res.error); return; } }
      toast.success("Alert created");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3">
      <div className="w-32 space-y-1.5">
        <label className="text-xs text-muted-foreground">Symbol</label>
        <Input name="symbol" required placeholder="BTC" className="uppercase" />
      </div>
      <div className="w-28 space-y-1.5">
        <label className="text-xs text-muted-foreground">Class</label>
        <input type="hidden" name="assetType" value={assetType} />
        <Select defaultValue={assetType} onValueChange={setAssetType}>
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
      <div className="w-28 space-y-1.5">
        <label className="text-xs text-muted-foreground">Direction</label>
        <input type="hidden" name="direction" value={direction} />
        <Select defaultValue={direction} onValueChange={setDirection}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="above">Above</SelectItem>
            <SelectItem value="below">Below</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="w-36 space-y-1.5">
        <label className="text-xs text-muted-foreground">Threshold price</label>
        <Input name="threshold" type="number" step="any" min="0" required />
      </div>
      <Button type="submit" disabled={pending}>
        Create alert
      </Button>
    </form>
  );
}
