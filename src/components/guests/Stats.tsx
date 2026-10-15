import Link from "next/link";
import type { ReactNode } from "react";
import type { DayBucket, EventStats } from "@/lib/guests/stats";
import { REGISTRATION_STATUSES, STATUS_LABELS } from "@/lib/guests/types";
import { Skeleton } from "@/components/ui/Skeleton";

const nf = new Intl.NumberFormat("en-GB");

export function StatTile({ label, value, hint, accent = false }: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-4 ${accent ? "border-gradient" : "border border-line bg-surface"}`}>
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-semibold tabular-nums ${accent ? "text-gradient" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatTiles({ stats, mode }: { stats: EventStats; mode: "tickets" | "external" | "none" }) {
  const going = stats.counts.going;
  return (
    <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 px-4 sm:grid-cols-3">
      <StatTile label="Page views" value={nf.format(stats.views)} />
      <StatTile label="Apply-now clicks" value={nf.format(stats.applyClicks)} hint={mode === "external" ? "To your registration page" : "External link only"} />
      <StatTile
        label="Conversion"
        value={stats.conversion === null ? "–" : `${stats.conversion}%`}
        hint={mode === "external" ? "Views → Apply now" : "Views → registrations"}
        accent
      />
      <StatTile label="Registrations" value={nf.format(stats.active)} hint={stats.counts.cancelled ? `+${stats.counts.cancelled} cancelled` : "All time"} />
      <StatTile label="Going" value={nf.format(going)} hint={stats.counts.pending ? `${stats.counts.pending} awaiting approval` : "Confirmed guests"} />
      <StatTile
        label="Checked in"
        value={<>{nf.format(stats.checkedIn)}<span className="text-base text-muted"> / {nf.format(going)}</span></>}
        hint={going ? `${Math.round((stats.checkedIn / going) * 100)}% of guests` : "No guests yet"}
      />
    </section>
  );
}

// Status → dot colour (brand tokens; the label always sits next to it, so colour is never alone).
const DOT: Record<string, string> = {
  going: "bg-emerald-400",
  pending: "bg-orange",
  waitlisted: "bg-blue",
  awaiting_payment: "bg-cream",
  declined: "bg-red-400",
  cancelled: "bg-muted/50",
};

export function StatusBreakdown({ stats, eventId }: { stats: EventStats; eventId: string }) {
  return (
    <section aria-labelledby="by-status" className="mx-4 rounded-2xl border border-line bg-surface p-4">
      <h2 id="by-status" className="font-display text-sm font-semibold">Registrations by status</h2>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {REGISTRATION_STATUSES.map((s) => (
          <li key={s}>
            <Link
              href={`/organiser/events/${eventId}/guests?status=${s}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2"
            >
              <span className="flex items-center gap-2 text-muted">
                <span className={`h-2 w-2 rounded-full ${DOT[s]}`} aria-hidden />
                {STATUS_LABELS[s]}
              </span>
              <span className="font-semibold tabular-nums">{nf.format(stats.counts[s])}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CapacityBar({ capacity }: { capacity: NonNullable<EventStats["capacity"]> }) {
  const { cap, going, held, percent } = capacity;
  const goingPct = Math.min(100, (going / cap) * 100);
  const heldPct = Math.min(100 - goingPct, (held / cap) * 100);
  const left = Math.max(0, cap - going - held);
  return (
    <section aria-labelledby="capacity" className="mx-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="capacity" className="font-display text-sm font-semibold">Capacity</h2>
        <p className="text-sm tabular-nums text-muted">
          <span className="font-semibold text-fg">{nf.format(going + held)}</span> / {nf.format(cap)} · {percent}%
        </p>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={cap}
        aria-valuenow={going + held}
        aria-valuetext={`${going} going and ${held} holding a spot, of ${cap}`}
        className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-full bg-surface-2"
      >
        {goingPct > 0 && <div className="bg-gradient h-full rounded-full" style={{ width: `${goingPct}%` }} />}
        {heldPct > 0 && <div className="h-full rounded-full bg-orange/70" style={{ width: `${heldPct}%` }} />}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="bg-gradient h-2 w-2 rounded-full" aria-hidden />{going} going</span>
        {held > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-orange/70" aria-hidden />{held} holding a spot</span>}
        <span>{left === 0 ? "Full" : `${left} left`}</span>
      </p>
    </section>
  );
}

/** Bar chart of new registrations per day. Each bar has a hover/focus tooltip and screen-reader text. */
export function RegistrationsChart({ days }: { days: DayBucket[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((s, d) => s + d.count, 0);
  const best = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
  return (
    <figure className="mx-4 rounded-2xl border border-line bg-surface p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-display text-sm font-semibold">Registrations · last 14 days</span>
        <span className="text-sm tabular-nums text-muted"><span className="font-semibold text-fg">{total}</span> total</span>
      </figcaption>
      {total === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
          No registrations in the last two weeks yet. Share the link to get things moving.
        </p>
      ) : (
        <>
          <p className="sr-only">{`Busiest day: ${best.label} with ${best.count}.`}</p>
          <ol className="mt-4 grid h-36 items-end gap-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((d, i) => (
              <li key={d.key} className="group relative flex h-full flex-col justify-end outline-none" tabIndex={0}>
                <span className="sr-only">{`${d.label}: ${d.count} registration${d.count === 1 ? "" : "s"}`}</span>
                <span
                  aria-hidden
                  className={`pointer-events-none absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11px] opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus:opacity-100 ${
                    i < 3 ? "left-0" : i > days.length - 4 ? "right-0" : "left-1/2 -translate-x-1/2"
                  }`}
                >
                  {d.label} · <span className="font-semibold">{d.count}</span>
                </span>
                <span
                  aria-hidden
                  className={`block w-full rounded-t-[4px] transition-[filter] group-hover:brightness-125 ${d.count ? "bg-gradient" : "bg-line"}`}
                  style={{ height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : "2px" }}
                />
              </li>
            ))}
          </ol>
          <div className="mt-1.5 grid gap-1 text-center text-[10px] tabular-nums text-muted" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} aria-hidden>
            {days.map((d, i) => (
              <span key={d.key} className={i % 2 === (days.length - 1) % 2 ? "" : "invisible sm:visible"}>
                {d.key.slice(8).replace(/^0/, "")}
              </span>
            ))}
          </div>
        </>
      )}
    </figure>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-4 px-4" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-28" />
      <Skeleton className="h-52" />
    </div>
  );
}
