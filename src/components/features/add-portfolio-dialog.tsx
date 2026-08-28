"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { createPortfolioAction } from "@/actions/portfolio.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldContent,
  FieldLabel,
} from "@/components/ui/field";

export function AddPortfolioDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function submit(fd: FormData) {
    startTransition(async () => {
      const res = await createPortfolioAction(fd);
      { if (res?.error) { toast.error(res.error); return; } }
      toast.success("Portfolio created");
      setOpen(false);
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <PlusIcon data-icon="inline-start" /> New portfolio
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <form ref={formRef} action={submit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New portfolio</DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="pname">Name</FieldLabel>
            <FieldContent>
              <Input id="pname" name="name" placeholder="e.g. Long-term / Trading" required maxLength={60} />
            </FieldContent>
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
