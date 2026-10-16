import Link from "next/link";

/**
 * Soft prompt for people who registered for an event before finishing setup. After the 30-second
 * setup, onboarding sends them back to `next` (their ticket).
 */
export function SetupNudge({ next, className = "" }: { next: string; className?: string }) {
  return (
    <Link
      href={`/onboarding?next=${encodeURIComponent(next)}`}
      className={`group glass flex items-center gap-3 rounded-[20px] p-3.5 transition-colors hover:bg-white/[0.09] ${className}`}
    >
      <span aria-hidden className="bg-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-base text-bg">✦</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold leading-snug text-fg">Get events like this — 30-second setup</span>
        <span className="block text-xs text-muted">Then we&apos;ll bring you straight back here.</span>
      </span>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  );
}
