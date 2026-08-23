"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseIcon, PlayIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ToggleAlertButton({
  action,
  active,
}: {
  action: () => Promise<{ ok?: boolean; error?: string }>;
  active: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={active ? "Pause alert" : "Re-arm alert"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await action();
          { if (res?.error) { toast.error(res.error); return; } }
          router.refresh();
        })
      }
    >
      {active ? (
        <PauseIcon className="h-4 w-4 text-muted-foreground" />
      ) : (
        <PlayIcon className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}
