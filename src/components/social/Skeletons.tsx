import { Skeleton } from "@/components/ui/Skeleton";

/** Fixed-height placeholders for the social screens, so nothing jumps when data streams in. */

function TabsSkeleton() {
  return <Skeleton className="mx-4 mb-4 h-9 rounded-full md:max-w-sm" />;
}

export function CirclesSkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3">
      {tabs && <TabsSkeleton />}
      <div className="space-y-3 px-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:gap-8 md:space-y-0">
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px] rounded-[22px]" />)}
        </div>
        <Skeleton className="h-64 rounded-[22px]" />
      </div>
    </div>
  );
}

export function GroupSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 px-4 pt-[var(--page-top,1.5rem)]">
      <Skeleton className="h-8 w-24 rounded-full" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-10 rounded-full md:max-w-md" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 rounded-[22px]" />)}
    </div>
  );
}

export function DirectorySkeleton({ tabs = false }: { tabs?: boolean }) {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      {tabs && <TabsSkeleton />}
      {/* Search, the two dropdowns and the grid / list switch, laid out like DirectoryFilters. */}
      <div className="flex flex-wrap gap-2 px-4">
        <Skeleton className="h-[42px] min-w-0 flex-1 rounded-[14px] sm:min-w-48" />
        <div className="order-last flex w-full gap-2 sm:order-none sm:w-auto">
          <Skeleton className="h-[42px] flex-1 rounded-[14px] sm:w-44 sm:flex-none lg:w-52" />
          <Skeleton className="h-[42px] flex-1 rounded-[14px] sm:w-44 sm:flex-none lg:w-56" />
        </div>
        <Skeleton className="h-[42px] w-[82px] shrink-0 rounded-full" />
      </div>
      <div className="space-y-3 px-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-36 rounded-[22px]" />)}
      </div>
    </div>
  );
}

/** A community's home: header, the pinned row, then channels beside the moderators' column. */
export function CommunityHomeSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 px-4 pt-[var(--page-top,1.5rem)]">
      <Skeleton className="h-8 w-2/3 md:w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-[74px] rounded-[22px]" />
      <Skeleton className="h-[42px] rounded-[14px]" />
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-[22px]" />)}
      </div>
    </div>
  );
}

/** A channel's chat, with its list beside it from `md`. */
export function ChannelSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:gap-6">
      <div className="hidden space-y-2 pt-[var(--page-top,1.5rem)] md:block">
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 rounded-[18px]" />)}
      </div>
      <ThreadSkeleton />
    </div>
  );
}

export function ConversationsSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading" className="glass mx-4 divide-y divide-line overflow-hidden rounded-[22px] md:max-w-2xl">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="flex items-center gap-3 px-4 py-3.5">
          <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ThreadSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-3 px-4 pt-[var(--page-top,1.5rem)] md:mx-auto md:max-w-2xl">
      <Skeleton className="h-12 rounded-[18px]" />
      {["w-3/5", "w-2/5", "w-3/4", "w-1/2", "w-1/3"].map((w, i) => (
        <div key={w} className={`flex ${i % 2 ? "justify-end" : ""}`}>
          <Skeleton className={`h-10 rounded-[18px] ${w}`} />
        </div>
      ))}
    </div>
  );
}

/** The invite card on /join/circle/<code>, /join/community/<code> and /join/channel/<code>. */
export function JoinSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="glass-strong flex w-full flex-col items-center rounded-[28px] p-6">
      <Skeleton className="-mt-2 h-[72px] w-[72px] rounded-full" />
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-5 h-6 w-1/2 rounded-full" />
      <Skeleton className="mt-6 h-12 w-full rounded-full" />
    </div>
  );
}
