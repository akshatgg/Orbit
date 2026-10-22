import Link from "next/link";
import type { RegistrationStatus } from "@/types/database";
import { type EventCardData, type EventCounts } from "@/lib/events/queries";
import { formatEventDate } from "@/lib/format";
import { seriesHint } from "@/lib/events/series";
import { EventCard } from "@/components/events/EventCard";
import { EventCover } from "@/components/events/EventCover";
import { eventPlace } from "@/components/events/EventRow";
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
  /** Cover-on-top layout from md up, for grids. */
  tile?: boolean;
};

/**
 * EventCard with a roomier footer: the "Recommended because…" line can wrap to two lines
 * and sits next to the "Not interested" action.
 */
export function RankedCard({ event, counts, saved, registration, reason, dismissible, tile }: CardProps) {
  const footer = reason || dismissible;
  return (
    <div className={`glass overflow-hidden rounded-[22px] ${tile ? "md:flex md:h-full md:flex-col md:[&>article]:flex-1" : ""} transition duration-200 ease-out hover:border-ink/15 motion-reduce:transition-none [&>article]:rounded-none [&>article]:border-0 [&>article]:bg-transparent [&>article]:shadow-none [&>article]:backdrop-blur-none [&>article]:hover:translate-y-0 [&>article]:hover:bg-ink/[0.04]`}>
      <EventCard event={event} counts={counts} saved={saved} registration={registration} tile={tile} />
      {footer && (
        <div className="flex items-center gap-2 border-t border-ink/[0.07] py-2 pl-3.5 pr-2">
          <p className="line-clamp-2 min-w-0 flex-1 text-xs leading-relaxed text-muted">
            {reason}
          </p>
          {dismissible && <NotInterestedButton id={event.id} title={event.title} />}
        </div>
      )}
    </div>
  );
}

/** Tall card for horizontal carousels (This Week → Top picks). */
export function PickCard({ event, counts, saved, reason, rank }: CardProps & { rank: number }) {
  return (
    <article className="glass group relative w-64 shrink-0 snap-start overflow-hidden rounded-[22px] transition duration-200 ease-out hover:border-ink/15 motion-reduce:transition-none">
      <Link href={`/events/${event.id}`} className="block">
        <div className="relative aspect-[16/10] overflow-hidden">
          <EventCover src={event.cover_url} title={event.title} />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <span className="glass-float absolute bottom-2.5 left-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold tabular-nums text-fg">
            {rank}
          </span>
        </div>
        <div className="space-y-1.5 p-3.5">
          <p className="text-xs font-medium text-accent">{formatEventDate(event.starts_at)}{seriesHint(event)}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold leading-snug tracking-tight">{event.title}</h3>
          <p className="truncate text-xs text-muted">
            {event.organiser?.name ?? eventPlace(event).text}
            {counts && counts.going > 0 && ` · ${counts.going} going`}
          </p>
          {reason && (
            <p className="line-clamp-2 text-[11px] leading-relaxed text-muted">
              {reason.replace(/^Recommended because /, "Because ")}
            </p>
          )}
        </div>
      </Link>
      {saved !== undefined && (
        <div className="absolute right-2.5 top-2.5">
          <SaveButton eventId={event.id} saved={saved} />
        </div>
      )}
    </article>
  );
}
