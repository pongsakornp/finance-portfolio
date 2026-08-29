"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  SearchIcon,
} from "lucide-react";

import { AddPortfolioDialog } from "@/components/features/add-portfolio-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Portfolio = { id: string; name: string };

export function PortfolioSwitcher({ portfolios }: { portfolios: Portfolio[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // only render on a specific portfolio page (/portfolios/[id]), not the list
  const isPortfolioPage = /^\/portfolios\/[^/]+$/.test(pathname);
  if (!isPortfolioPage) return null;

  const active =
    portfolios.find((p) => pathname.startsWith(`/portfolios/${p.id}`)) ??
    portfolios[0];
  const count = portfolios.length;
  const filtered = portfolios.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  function select(id: string) {
    setOpen(false);
    setQuery("");
    router.push(`/portfolios/${id}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label="Switch portfolio"
            className={cn(
              "h-9 justify-start gap-2 rounded-3xl px-3 font-normal",
              count === 0 && "text-muted-foreground"
            )}
          />
        }
      >
        <span className="truncate font-medium">{active?.name ?? "No portfolio"}</span>
        <ChevronsUpDownIcon className="size-4 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="relative">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search portfolio names..."
            className="rounded-full pl-9"
          />
        </div>

        <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>
          )}
          {filtered.map((p) => {
            const isActive = active?.id === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => select(p.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left text-sm hover:bg-muted",
                  isActive && "bg-muted"
                )}
              >
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                {isActive && <CheckIcon className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>
            {count} portfolio{count === 1 ? "" : "s"}
          </span>
          <AddPortfolioDialog
            onCreated={() => {
              setOpen(false);
              router.push("/portfolios");
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
