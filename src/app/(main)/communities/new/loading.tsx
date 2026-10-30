import { Skeleton } from "@/components/ui/Skeleton";

export function NewCommunitySkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-6 px-4">
      <Skeleton className="h-36 rounded-[22px]" />
      <Skeleton className="h-64 rounded-[22px]" />
      <Skeleton className="h-44 rounded-[22px]" />
      <Skeleton className="h-12 rounded-full" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl pb-8">
      <div className="space-y-3 px-4 pb-5 pt-[var(--page-top,max(env(safe-area-inset-top),1.5rem))]">
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-8 w-56" />
      </div>
      <NewCommunitySkeleton />
    </div>
  );
}
