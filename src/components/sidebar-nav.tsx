"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BellIcon,
  ChartPieIcon,
  FileInputIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  SettingsIcon,
  WalletIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/portfolios", label: "Portfolios", icon: WalletIcon },
  { href: "/transactions", label: "Transactions", icon: ScrollTextIcon },
  { href: "/alerts", label: "Alerts", icon: BellIcon },
  { href: "/reports", label: "Reports", icon: ChartPieIcon },
  { href: "/import", label: "Import / Export", icon: FileInputIcon },
];

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <>
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
            pathname.startsWith(href) && "bg-accent text-accent-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </>
  );
}

export function SidebarFooter() {
  const pathname = usePathname();
  return (
    <Link
      href="/settings"
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
        pathname.startsWith("/settings") && "bg-accent text-accent-foreground"
      )}
    >
      <SettingsIcon className="h-4 w-4" />
      Settings
    </Link>
  );
}
