"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createAlertAction } from "@/actions/alert.actions";
import { Button } from "@/components/ui/button";
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
    <form action={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
      <Field>
        <FieldLabel htmlFor="symbol">Symbol</FieldLabel>
        <FieldContent>
          <Input id="symbol" name="symbol" required placeholder="BTC" className="uppercase" />
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Class</FieldLabel>
        <FieldContent>
          <input type="hidden" name="assetType" value={assetType} />
          <Select defaultValue={assetType} onValueChange={(v) => v && setAssetType(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) =>
                  ({
                    stock: "Stock",
                    etf: "ETF",
                    crypto: "Crypto",
                    commodity: "Commodity",
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
              <SelectItem value="mutualfund">Fund</SelectItem>
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel>Direction</FieldLabel>
        <FieldContent>
          <input type="hidden" name="direction" value={direction} />
          <Select defaultValue={direction} onValueChange={(v) => v && setDirection(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v) => ({ above: "Above", below: "Below" }[String(v)] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="above">Above</SelectItem>
              <SelectItem value="below">Below</SelectItem>
            </SelectContent>
          </Select>
        </FieldContent>
      </Field>
      <Field>
        <FieldLabel htmlFor="threshold">Threshold price</FieldLabel>
        <FieldContent>
          <Input id="threshold" name="threshold" type="number" step="any" min="0" required />
        </FieldContent>
      </Field>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        Create alert
      </Button>
    </form>
  );
}
