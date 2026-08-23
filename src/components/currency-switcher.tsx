"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { setBaseCurrencyAction } from "@/actions/user.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CurrencySwitcher({ value }: { value: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Select
      defaultValue={value}
      disabled={pending}
      onValueChange={(baseCurrency) => {
        const fd = new FormData();
        fd.set("baseCurrency", baseCurrency);
        startTransition(async () => {
          await setBaseCurrencyAction(fd);
          router.refresh();
        });
      }}
    >
      <SelectTrigger className="w-[72px]" aria-label="Display currency">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="USD">USD</SelectItem>
        <SelectItem value="THB">THB</SelectItem>
      </SelectContent>
    </Select>
  );
}
