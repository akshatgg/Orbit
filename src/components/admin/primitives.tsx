import Link from "next/link";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

/** Page title row for admin screens (the layout already pads horizontally). */
export function AdminHeader({ title, subtitle, action, eyebrow }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; eyebrow?: string;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-6 pt-2">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-muted">{eyebrow}</p>}
        <h1 className="font-display text-2xl font-semibold tracking-wide sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
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
    <section id={id} className={`rounded-2xl border border-line bg-surface/80 ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="font-display text-sm font-semibold tracking-wide">{title}</h2>}
          {action && <div className="text-xs">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

/** KPI tile. `accent` gives the iridescent border + glow for the numbers that matter most. */
export function KpiTile({ label, value, hint, href, accent = false, alert = false }: {
  label: string; value: ReactNode; hint?: ReactNode; href?: string; accent?: boolean; alert?: boolean;
}) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className={`mt-2 font-display text-3xl font-semibold tabular-nums ${accent ? "text-gradient" : ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {alert && <span className="absolute right-3 top-3 h-2 w-2 animate-pulse rounded-full bg-orange shadow-[0_0_12px_var(--orange)]" aria-hidden />}
    </>
  );
  const cls = `relative block rounded-2xl p-4 transition-colors ${
    accent ? "border-gradient glow" : "border border-line bg-surface/80"
  } ${href ? "hover:bg-surface-2" : ""}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

export type TabItem = { key: string; label: string; count?: number; href: string; active: boolean };

/** Link tabs with counts (server-rendered; state lives in the URL). */
export function CountTabs({ items, label }: { items: TabItem[]; label: string }) {
  return (
    <nav aria-label={label} className="scrollbar-none mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {items.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            t.active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
          }`}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={`rounded-full px-1.5 py-px text-[11px] tabular-nums ${t.active ? "bg-gradient text-bg" : "bg-surface-2 text-muted"}`}>
              {t.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

/** Shared table styles: dense rows, sticky header, horizontal scroll on small screens. */
export const table = {
  wrap: "overflow-x-auto rounded-2xl border border-line bg-surface/80",
  table: "w-full min-w-[720px] border-collapse text-left text-sm",
  th: "sticky top-0 border-b border-line bg-surface px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted",
  tr: "border-b border-line/60 last:border-0 hover:bg-surface-2/50",
  td: "px-3 py-2.5 align-middle",
};

export function Pagination({ page, pageCount, hrefFor, total, noun }: {
  page: number; pageCount: number; hrefFor: (page: number) => string; total: number; noun: string;
}) {
  if (total === 0) return null;
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-3 text-sm text-muted">
      <span className="tabular-nums">{total} {noun}{total === 1 ? "" : "s"} · page {page} of {Math.max(1, pageCount)}</span>
      <div className="flex gap-1">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2 hover:text-fg">Previous</Link>
        ) : (
          <span className="rounded-lg border border-line/50 px-3 py-1.5 opacity-40">Previous</span>
        )}
        {page < pageCount ? (
          <Link href={hrefFor(page + 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2 hover:text-fg">Next</Link>
        ) : (
          <span className="rounded-lg border border-line/50 px-3 py-1.5 opacity-40">Next</span>
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
      <Skeleton className="h-10" />
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-12 opacity-70" />)}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <div className="bg-gradient mb-3 h-1.5 w-10 rounded-full opacity-70" aria-hidden />
      <p className="font-display text-base font-semibold">{title}</p>
      {children && <div className="mt-1.5 max-w-sm text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
