import { Skeleton } from "@/components/ui/Skeleton";

export function EventPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading event">
      <Skeleton className="aspect-[16/11] w-full rounded-none" />
      <div className="space-y-4 px-4 pt-6">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-16" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}

export function TicketsSkeleton() {
  return (
    <div className="space-y-3 px-4" aria-busy="true" aria-label="Loading tickets">
      <Skeleton className="h-11" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
    </div>
  );
}

export function PassSkeleton() {
  return (
    <div className="space-y-4 px-4" aria-busy="true" aria-label="Loading ticket">
      <Skeleton className="h-[520px] rounded-3xl" />
      <Skeleton className="h-12" />
    </div>
  );
}
