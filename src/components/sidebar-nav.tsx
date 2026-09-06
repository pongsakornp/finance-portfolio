"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/actions/auth.actions";

import {
  BellIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ScrollTextIcon,
  SettingsIcon,
  Wallet2Icon,
  WalletIcon,
} from "lucide-react";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/portfolios", label: "Portfolios", icon: WalletIcon },
  { href: "/transactions", label: "Transactions", icon: ScrollTextIcon },
  { href: "/alerts", label: "Alerts", icon: BellIcon },
];

export function SidebarBrand() {
  return (
    <div className="flex h-10 w-full items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <Wallet2Icon className="size-5 shrink-0" />
      <span className="truncate group-data-[collapsible=icon]:hidden">Portfolio</span>
    </div>
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {links.map(({ href, label, icon: Icon }) => (
            <SidebarMenuItem key={href}>
              <SidebarMenuButton
                isActive={pathname.startsWith(href)}
                tooltip={label}
                render={<Link href={href} />}
              >
                <Icon />
                <span>{label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SidebarFooter() {
  const pathname = usePathname();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={pathname.startsWith("/settings")}
          tooltip="Settings"
          render={<Link href="/settings" />}
        >
          <SettingsIcon />
          <span>Settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          tooltip="Sign out"
          onClick={() => void signOutAction()}
        >
          <LogOutIcon />
          <span>Sign out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
