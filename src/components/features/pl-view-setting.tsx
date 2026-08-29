"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setPlViewAction } from "@/actions/user.actions";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export function PlViewSetting({ value }: { value: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      value={[value]}
      disabled={pending}
      onValueChange={(v) => {
        const next = v[0];
        if (next !== "unrealized" && next !== "daily") return;
        const fd = new FormData();
        fd.set("plView", next);
        startTransition(async () => {
          const res = await setPlViewAction(fd);
          { if (res?.error) { toast.error(res.error); return; } }
          router.refresh();
        });
      }}
    >
      <ToggleGroupItem value="unrealized">Since open</ToggleGroupItem>
      <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
    </ToggleGroup>
  );
}
