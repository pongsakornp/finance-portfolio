import { Skeleton } from "@/components/ui/skeleton";

export default function PortfolioDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-8 w-48" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-[360px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}
