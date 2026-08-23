import { eq } from "drizzle-orm";
import { MenuIcon, Wallet2Icon } from "lucide-react";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";

import { CurrencySwitcher } from "@/components/currency-switcher";
import { SidebarNav } from "@/components/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireUserId();
  const [user] = await db
    .select({ baseCurrency: users.baseCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return (
    <div className="flex min-h-svh">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <Wallet2Icon className="h-5 w-5" />
          <span className="font-semibold tracking-tight">Portfolio</span>
        </div>
        <nav className="flex flex-col gap-1">{<SidebarNav />}</nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <MenuIcon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-base">
                  <Wallet2Icon className="h-4 w-4" /> Portfolio
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-4 flex flex-col gap-1">{<SidebarNav />}</nav>
            </SheetContent>
          </Sheet>
          <div className="ml-auto flex items-center gap-1">
            <CurrencySwitcher value={user?.baseCurrency ?? "USD"} />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
