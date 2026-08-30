"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Result = { ok?: boolean; error?: string; [key: string]: unknown };

type ButtonProps = React.ComponentProps<typeof Button>;

export function ConfirmButton({
  action,
  confirmText,
  title = "Confirm action",
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  successMessage = "Done",
  redirectTo,
  onSuccess,
  ariaLabel,
  destructive = false,
  variant = "ghost",
  size = "icon",
  children,
}: {
  action: () => Promise<Result>;
  confirmText: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  successMessage?: string;
  redirectTo?: string;
  onSuccess?: (res: Result) => void;
  ariaLabel: string;
  destructive?: boolean;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  children: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  function run() {
    startTransition(async () => {
      const res: Result = await action();
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setOpen(false);
      toast.success(successMessage);
      onSuccess?.(res);
      router.refresh();
      if (redirectTo) router.push(redirectTo);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant={variant} size={size} aria-label={ariaLabel} disabled={pending}>
            {children}
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{confirmText}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" />}>
            {cancelLabel}
          </AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} disabled={pending} onClick={run}>
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
