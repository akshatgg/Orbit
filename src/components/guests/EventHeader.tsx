import Link from "next/link";
import type { EventStatus } from "@/types/database";
import type { ManagedEvent } from "@/lib/guests/queries";
import { formatEventDate, formatTimeRange, FORMAT_LABELS } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import { EventCover } from "@/components/events/EventCover";
import { Skeleton } from "@/components/ui/Skeleton";

const STATUS: Record<EventStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" | "info" }> = {
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  expired: { label: "Ended", tone: "neutral" },
  removed: { label: "Removed", tone: "danger" },
};

export function EventStatusBadge({ status, endsAt }: { status: EventStatus; endsAt?: string | null }) {
  const ended = status === "published" && endsAt && new Date(endsAt) < new Date();
  const s = ended ? STATUS.expired : STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

function where(event: ManagedEvent) {
  if (event.format === "online") return FORMAT_LABELS.online;
  return event.venue_name ?? FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS] ?? null;
}

/** Cover, status, title and when/where — the top of every event management page. */
export function EventHeader({ event, compact = false }: { event: ManagedEvent; compact?: boolean }) {
  const end = event.ends_at ?? event.starts_at;
  return (
    <header className="px-4 pt-5">
      <Link href="/organiser" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <span aria-hidden>←</span> Studio
      </Link>
      <div className={`mt-3 flex gap-4 ${compact ? "items-center" : "flex-col sm:flex-row sm:items-end"}`}>
        <div className={`relative shrink-0 overflow-hidden rounded-2xl border border-line ${compact ? "h-14 w-14" : "aspect-[2/1] w-full sm:aspect-auto sm:h-32 sm:w-56"}`}>
          {compact && !event.cover_url ? (
            <div className="bg-gradient h-full w-full opacity-60" aria-hidden />
          ) : (
            <EventCover src={event.cover_url} title={event.title} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <EventStatusBadge status={event.status} endsAt={end} />
            {event.requires_approval && <Badge tone="brand">Applications</Badge>}
            {event.organiser && <span className="truncate text-xs text-muted">{event.organiser.name}</span>}
          </div>
          <h1 className={`mt-1.5 font-display font-semibold leading-tight tracking-wide ${compact ? "text-lg" : "text-2xl"}`}>
            {event.title}
          </h1>
          <p className="mt-1 text-sm text-muted">
            <span className="text-pink">{formatEventDate(event.starts_at)}</span>
            {event.ends_at && <> – {formatTimeRange(event.ends_at)}</>}
            {where(event) && <> · {where(event)}</>}
          </p>
        </div>
      </div>
    </header>
  );
}

export function EventHeaderSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="px-4 pt-5" aria-hidden>
      <Skeleton className="h-4 w-16" />
      <div className={`mt-3 flex gap-4 ${compact ? "items-center" : "flex-col sm:flex-row sm:items-end"}`}>
        <Skeleton className={compact ? "h-14 w-14" : "aspect-[2/1] w-full sm:aspect-auto sm:h-32 sm:w-56"} />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

/** Overview / Guests / Check-in switcher. */
export function EventNav({ eventId, active, pending = 0 }: { eventId: string; active: "overview" | "guests" | "check-in"; pending?: number }) {
  const base = `/organiser/events/${eventId}`;
  const items = [
    { key: "overview", href: base, label: "Overview" },
    { key: "guests", href: `${base}/guests`, label: "Guests" },
    { key: "check-in", href: `${base}/check-in`, label: "Check-in" },
  ] as const;
  return (
    <nav aria-label="Event management" className="mx-4 mt-5 flex gap-1 rounded-xl border border-line bg-surface p-1">
      {items.map((item) => {
        const on = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={`flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              on ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {item.label}
            {item.key === "guests" && pending > 0 && (
              <span className="rounded-full bg-orange/15 px-1.5 text-[11px] font-semibold text-orange" aria-label={`${pending} pending`}>
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
