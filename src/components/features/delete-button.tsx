"use client";

import { Trash2Icon } from "lucide-react";

import { ConfirmButton } from "@/components/features/confirm-button";

export function DeleteButton({
  action,
  confirmText = "Are you sure? This cannot be undone.",
  redirectTo,
}: {
  action: () => Promise<{ ok?: boolean; error?: string }>;
  confirmText?: string;
  redirectTo?: string;
}) {
  return (
    <ConfirmButton
      action={action}
      confirmText={confirmText}
      title="Confirm delete"
      confirmLabel="Delete"
      successMessage="Deleted"
      redirectTo={redirectTo}
      ariaLabel="Delete"
      destructive
    >
      <Trash2Icon className="text-muted-foreground" />
    </ConfirmButton>
  );
}
