import { Skeleton } from "@/components/ui/Skeleton";

export function EventPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-4 px-4 pt-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-16 rounded-[22px]" />
        <Skeleton className="h-48 rounded-[22px]" />
        <Skeleton className="h-32 rounded-[22px]" />
      </div>
    </div>
  );
}

export function TicketsSkeleton() {
  return (
    <div className="space-y-3 px-4" aria-busy="true" aria-label="Loading tickets">
      <Skeleton className="h-11" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-[22px]" />)}
    </div>
  );
}

export function PassSkeleton() {
  return (
    <div className="space-y-4 px-4" aria-busy="true" aria-label="Loading ticket">
      <Skeleton className="h-[520px] rounded-[28px]" />
      <Skeleton className="h-12" />
    </div>
  );
}
