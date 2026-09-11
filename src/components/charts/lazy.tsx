"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

// ssr:false is not allowed directly in server components, so charts are
// code-split here and imported from pages via this client wrapper.
export const PerformanceChart = dynamic(
  () => import("./performance-chart").then((m) => m.PerformanceChart),
  { ssr: false, loading: () => <Skeleton className="h-[312px] w-full" /> }
);

export const UnrealizedPLChart = dynamic(
  () => import("./unrealized-pl-chart").then((m) => m.UnrealizedPLChart),
  { ssr: false, loading: () => <Skeleton className="h-[312px] w-full" /> }
);

export const AllocationDonut = dynamic(
  () => import("./allocation-donut").then((m) => m.AllocationDonut),
  {
    ssr: false,
    loading: () => <Skeleton className="mx-auto aspect-square max-h-[260px] w-full max-w-[260px]" />,
  }
);

export const MonthlyBarsChart = dynamic(
  () => import("./monthly-bars-chart").then((m) => m.MonthlyBarsChart),
  { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> }
);
