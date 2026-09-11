import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Skeleton className="h-8 w-48" />
        <div className="flex shrink-0 items-center gap-2">
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-8 w-36" />
        </div>
      </div>
      <Skeleton className="h-[480px] rounded-xl" />
    </div>
  );
}
