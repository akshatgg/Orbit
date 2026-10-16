import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/** Brand header for the discovery screens: small ORBIT wordmark, big display title. */
export function DiscoveryHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="px-4 pb-4 pt-[max(env(safe-area-inset-top),1.25rem)] lg:pt-8">
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-[11px] font-semibold tracking-[0.4em] text-subtle">
          <span className="text-gradient">ORBIT</span>
        </p>
        {action}
      </div>
      <h1 className="mt-3 text-[1.75rem] font-semibold leading-tight tracking-tight lg:text-4xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </header>
  );
}

/** Section title with an optional count and a trailing link/action. */
export function SectionHeading({ id, eyebrow, title, count, action }: {
  id?: string; eyebrow?: string; title: string; count?: number; action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-subtle">{eyebrow}</p>
        )}
        <h2 id={id} className="text-lg font-semibold tracking-tight">
          {title}
          {count !== undefined && <span className="ml-2 align-middle text-xs font-medium text-muted">{count}</span>}
        </h2>
      </div>
      {action}
    </div>
  );
}

/** Round icon link used in headers (e.g. search, calendar export). */
export function IconLink({ href, label, path, download }: { href: string; label: string; path: string; download?: boolean }) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      download={download}
      className="glass flex h-10 w-10 items-center justify-center rounded-full text-muted transition duration-200 ease-out hover:bg-white/[0.09] hover:text-fg active:scale-95 motion-reduce:transition-none"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </a>
  );
}

export const ICONS = {
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 19h14",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0",
  chevronLeft: "M15 6l-6 6 6 6",
  chevronRight: "M9 6l6 6-6 6",
} as const;

function CardRowSkeleton() {
  return (
    <div className="glass flex gap-3 rounded-[22px] p-3">
      <Skeleton className="h-24 w-24 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-2 py-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function CardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: rows }, (_, i) => <CardRowSkeleton key={i} />)}
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your feed" className="space-y-6">
      <div className="glass mx-4 overflow-hidden rounded-[26px]">
        <Skeleton className="aspect-[16/9] rounded-none" />
        <div className="space-y-2 p-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <CardListSkeleton rows={3} />
    </div>
  );
}

export function WeekSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading this week" className="space-y-6">
      <div className="flex gap-3 overflow-hidden px-4">
        {[0, 1].map((i) => (
          <div key={i} className="glass w-64 shrink-0 overflow-hidden rounded-[22px]">
            <Skeleton className="aspect-[16/10] rounded-none" />
            <div className="space-y-2 p-3">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
      <CardListSkeleton rows={3} />
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading calendar" className="space-y-4 px-4">
      <div className="glass rounded-[26px] p-4">
        <Skeleton className="mx-auto mb-4 h-5 w-36" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 35 }, (_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />)}
        </div>
      </div>
      <Skeleton className="h-28 rounded-[22px]" />
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="space-y-3 px-4">
        <Skeleton className="h-12 rounded-[14px]" />
        <Skeleton className="h-10 rounded-full" />
      </div>
      <CardListSkeleton rows={3} />
    </div>
  );
}
