import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUserId } from "@/lib/session";

import { CurrencySwitcher } from "@/components/currency-switcher";
import {
  SidebarBrand,
  SidebarFooter,
  SidebarNav,
} from "@/components/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter as SidebarFooterShell,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

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
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarBrand />
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav />
        </SidebarContent>
        <SidebarFooterShell>
          <Separator className="mb-3" />
          <SidebarFooter />
        </SidebarFooterShell>
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto flex items-center gap-1">
            <CurrencySwitcher value={user?.baseCurrency ?? "USD"} />
            <ThemeToggle />
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
