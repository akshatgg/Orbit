import Link from "next/link";
import type { RegistrationStatus } from "@/types/database";
import { spotsLeft, type EventCardData, type EventCounts } from "@/lib/events/queries";
import { FORMAT_LABELS, formatDeadline, formatEventDate, formatPrice } from "@/lib/format";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { EventCard } from "@/components/events/EventCard";
import { EventCover } from "@/components/events/EventCover";
import { SaveButton } from "@/components/events/SaveButton";
import { NotInterestedButton } from "./Dismiss";

type CardProps = {
  event: EventCardData;
  counts?: EventCounts;
  saved?: boolean;
  registration?: RegistrationStatus;
  reason?: string | null;
  /** Show "Not interested" (needs a surrounding <DismissProvider>). */
  dismissible?: boolean;
};

/** The ✦ sparkle used in front of every "Recommended because…" line. */
export function Sparkle({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`text-gradient font-semibold ${className}`}>✦</span>;
}

/**
 * EventCard with a roomier footer: the "Recommended because…" line can wrap to two lines
 * and sits next to the "Not interested" action.
 */
export function RankedCard({ event, counts, saved, registration, reason, dismissible }: CardProps) {
  const footer = reason || dismissible;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-violet/50 [&>article]:rounded-none [&>article]:border-0">
      <EventCard event={event} counts={counts} saved={saved} registration={registration} />
      {footer && (
        <div className="flex items-center gap-2 border-t border-line px-3 py-2">
          <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-muted">
            {reason && <><Sparkle /> {reason}</>}
          </p>
          {dismissible && <NotInterestedButton id={event.id} title={event.title} />}
        </div>
      )}
    </div>
  );
}

function venueLabel(event: EventCardData) {
  if (event.format === "in_person") return event.venue_name ?? FORMAT_LABELS.in_person;
  return FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS] ?? event.format;
}

function MetaBadges({ event, counts }: { event: EventCardData; counts?: EventCounts }) {
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const left = counts ? spotsLeft(event, counts) : null;
  const deadline = formatDeadline(event.registration_deadline);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {price && <Badge tone={price === "Free" ? "success" : "neutral"}>{price}</Badge>}
      <Badge>{venueLabel(event)}</Badge>
      {left !== null && left <= 10 && (
        <Badge tone={left === 0 ? "danger" : "warning"}>{left === 0 ? "Full" : `${left} left`}</Badge>
      )}
      {deadline && deadline !== "Registration closed" && event.registration_mode !== "none" && (
        <Badge tone="brand">{deadline}</Badge>
      )}
      {counts && counts.going > 0 && <span className="text-[11px] text-muted">{counts.going} going</span>}
    </div>
  );
}

/** The highlighted first recommendation on For You. */
export function TopPickCard({ event, counts, saved, reason, dismissible }: CardProps) {
  return (
    <article className="border-gradient glow group relative overflow-hidden rounded-3xl">
      <Link href={`/events/${event.id}`} className="block focus-visible:outline-none">
        <div className="relative aspect-[16/9] overflow-hidden">
          <EventCover src={event.cover_url} title={event.title} className="transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-bg/70 px-2.5 py-1 font-display text-[10px] font-semibold uppercase tracking-[0.25em] backdrop-blur">
            <Sparkle /> Top pick
          </span>
        </div>
        <div className="relative -mt-8 space-y-2 px-4 pb-4">
          <p className="text-xs font-semibold text-pink">{formatEventDate(event.starts_at)}</p>
          <h2 className="font-display text-xl font-semibold leading-snug">{event.title}</h2>
          {event.organiser && (
            <p className="flex items-center gap-1 text-sm text-muted">
              {event.organiser.name}
              {event.organiser.is_verified && <VerifiedMark className="h-3.5 w-3.5 text-[8px]" />}
            </p>
          )}
          <MetaBadges event={event} counts={counts} />
        </div>
      </Link>
      {saved !== undefined && (
        <div className="absolute right-3 top-3">
          <SaveButton eventId={event.id} saved={saved} />
        </div>
      )}
      {(reason || dismissible) && (
        <div className="flex items-center gap-2 border-t border-line/80 px-4 py-2.5">
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-fg/85">
            {reason && <><Sparkle /> {reason}</>}
          </p>
          {dismissible && <NotInterestedButton id={event.id} title={event.title} />}
        </div>
      )}
    </article>
  );
}

/** Tall card for horizontal carousels (This Week → Top picks). */
export function PickCard({ event, counts, saved, reason, rank }: CardProps & { rank: number }) {
  return (
    <article className="relative w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-violet/50">
      <Link href={`/events/${event.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          <EventCover src={event.cover_url} title={event.title} />
          <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
          <span className="bg-gradient absolute bottom-2 left-3 flex h-7 w-7 items-center justify-center rounded-full font-display text-sm font-bold text-bg">
            {rank}
          </span>
        </div>
        <div className="space-y-1.5 p-3">
          <p className="text-xs font-semibold text-pink">{formatEventDate(event.starts_at)}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold leading-snug">{event.title}</h3>
          <p className="truncate text-xs text-muted">
            {event.organiser?.name ?? venueLabel(event)}
            {counts && counts.going > 0 && ` · ${counts.going} going`}
          </p>
          {reason && (
            <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">
              <Sparkle /> {reason.replace(/^Recommended because /, "Because ")}
            </p>
          )}
        </div>
      </Link>
      {saved !== undefined && (
        <div className="absolute right-2 top-2">
          <SaveButton eventId={event.id} saved={saved} />
        </div>
      )}
    </article>
  );
}
