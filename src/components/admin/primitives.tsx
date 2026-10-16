import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/PageHeader";
import { buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

/** Page title row for admin screens (the layout already pads horizontally). */
export function AdminHeader({ title, subtitle, action, eyebrow }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; eyebrow?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-7 pt-2">
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-2">{eyebrow}</Eyebrow>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-xl text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

/** Card section with a heading and optional right-aligned link/action. */
export function Panel({ title, action, children, className = "", id }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string;
}) {
  return (
    <section id={id} className={`glass rounded-[20px] ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="text-sm font-semibold tracking-tight">{title}</h2>}
          {action && <div className="text-xs">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** KPI tile. `accent` marks the numbers that matter most. */
export function KpiTile({ label, value, hint, href, accent = false, alert = false }: {
  label: string; value: ReactNode; hint?: ReactNode; href?: string; accent?: boolean; alert?: boolean;
}) {
  const body = (
    <>
      <p className="relative text-xs font-medium text-muted">{label}</p>
      <p className={`relative mt-2.5 text-[2rem] font-semibold leading-none tracking-tight tabular-nums ${accent ? "text-fg" : ""}`}>{value}</p>
      {hint && <p className="relative mt-2.5 text-xs text-subtle">{hint}</p>}
      {alert && <span className="absolute right-4 top-4 h-2 w-2 animate-pulse rounded-full bg-orange shadow-[0_0_12px_var(--orange)] motion-reduce:animate-none" aria-hidden />}
    </>
  );
  const cls = `glass relative block overflow-hidden rounded-[18px] p-5 transition duration-200 ${
    href ? "hover:border-ink/15 hover:bg-ink/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent" : ""
  }`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

export type TabItem = { key: string; label: string; count?: number; href: string; active: boolean };

/** Link tabs with counts (server-rendered; state lives in the URL). */
export function CountTabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="glass scrollbar-none mb-4 flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            t.active ? "bg-gradient text-bg" : "text-muted hover:bg-ink/[0.06] hover:text-fg"
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${t.active ? "bg-ink/10 text-bg" : "bg-ink/[0.08] text-muted"}`}>
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Shared table styles: glass container, dense rows, sticky header, horizontal scroll on small screens. */
export const table = {
  wrap: "glass max-h-[calc(100dvh-13rem)] overflow-auto rounded-[20px]",
  table: "w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm",
  th: "sticky top-0 z-[1] border-b border-line bg-bg px-4 py-3 text-xs font-medium text-muted first:rounded-tl-[20px] last:rounded-tr-[20px]",
  tr: "group/row transition-colors hover:bg-ink/[0.035] [&>td]:border-b [&>td]:border-line/60 last:[&>td]:border-0",
  td: "px-4 py-3 align-middle tabular-nums",
};

export function Pagination({ page, pageCount, hrefFor, total, noun }: {
  page: number; pageCount: number; hrefFor: (page: number) => string; total: number; noun: string;
}) {
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
      <span className="text-xs tabular-nums">{total} {noun}{total === 1 ? "" : "s"} · page {page} of {Math.max(1, pageCount)}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className={buttonClass({ variant: "secondary", size: "sm" })}>Previous</Link>
        ) : (
          <span aria-disabled className={buttonClass({ variant: "secondary", size: "sm", className: "pointer-events-none opacity-40" })}>Previous</span>
        )}
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className={buttonClass({ variant: "secondary", size: "sm" })}>Next</Link>
        ) : (
          <span aria-disabled className={buttonClass({ variant: "secondary", size: "sm", className: "pointer-events-none opacity-40" })}>Next</span>
        )}
      </div>
    </nav>
  );
}

/** Builds "/path?x=1&y=2", dropping empty values. */
export function hrefWith(path: string, params: Record<string, string | number | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-11 rounded-[16px]" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-14 rounded-[16px] opacity-70" />)}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-12 text-center">
      <div className="bg-gradient mb-4 h-1 w-8 rounded-full opacity-70" aria-hidden />
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Small section label inside panels. */
export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center justify-between text-xs font-medium text-muted">
      {children}
      {action && <span className="normal-case tracking-normal">{action}</span>}
    </h3>
  );
}

/** Glass segmented filter links (server-rendered). */
export function SegmentedLinks({ label, items }: { label: string; items: { key: string; label: string; href: string; active: boolean }[] }) {
  return (
    <nav aria-label={label} className="glass scrollbar-none flex max-w-full gap-0.5 overflow-x-auto rounded-full p-1 text-sm">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`whitespace-nowrap rounded-full px-3 py-1 font-medium transition-colors ${
            t.active ? "bg-gradient text-bg" : "text-muted hover:bg-ink/[0.06] hover:text-fg"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
