import { PortfolioSwitcher } from "@/components/portfolio-switcher";
import {
  SidebarBrand,
  SidebarFooter,
  SidebarNav,
} from "@/components/sidebar-nav";
import { getUserPortfolios } from "@/lib/services/view-service";
import { requireUserId } from "@/lib/session";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter as SidebarFooterShell,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userId = await requireUserId();
  const portfolios = await getUserPortfolios(userId);

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
          <SidebarSeparator className="mx-0 mb-3" />
          <SidebarFooter />
        </SidebarFooterShell>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-40 flex min-h-14 items-center gap-2 border-b bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <PortfolioSwitcher portfolios={portfolios} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
