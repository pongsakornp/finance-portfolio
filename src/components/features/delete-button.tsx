"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function DeleteButton({
  action,
  confirmText = "Are you sure?",
  redirectTo,
}: {
  action: () => Promise<{ ok?: boolean; error?: string }>;
  confirmText?: string;
  redirectTo?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Delete"
      disabled={pending}
      onClick={() => {
        if (!confirm(confirmText)) return;
        startTransition(async () => {
          const res = await action();
          { if (res?.error) { toast.error(res.error); return; } }
          toast.success("Deleted");
          router.refresh();
          if (redirectTo) router.push(redirectTo);
        });
      }}
    >
      <Trash2Icon className="text-muted-foreground" />
    </Button>
  );
}
