import Link from "next/link";
import type { RegistrationStatus } from "@/types/database";
import type { EventCardData } from "@/lib/events/queries";
import { spotsLeft, type EventCounts } from "@/lib/events/spots";
import { FORMAT_LABELS, formatDeadline, formatEventDate, formatPrice } from "@/lib/format";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { EventCover } from "./EventCover";
import { RegistrationBadge } from "./RegistrationBadge";
import { SaveButton } from "./SaveButton";

/**
 * The event card used in every list (feed, week, search, organiser pages, saved).
 * `reason` is the "Recommended because…" line; `actions` renders extra controls in the footer.
 */
export function EventCard({ event, counts, saved, registration, reason, actions, href, tile }: {
  event: EventCardData;
  counts?: EventCounts;
  saved?: boolean;
  registration?: RegistrationStatus;
  reason?: string | null;
  actions?: React.ReactNode;
  href?: string;
  /** From md up, stack the cover above the details (for multi-column grids). Phones are unchanged. */
  tile?: boolean;
}) {
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const left = counts ? spotsLeft(event, counts) : null;
  const deadline = formatDeadline(event.registration_deadline);
  const cancelled = event.status === "cancelled";

  return (
    <article className={`glass group relative overflow-hidden rounded-[22px] ${tile ? "md:flex md:h-full md:flex-col" : ""} transition duration-200 ease-out hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.07] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}>
      <Link href={href ?? `/events/${event.id}`} className={`flex gap-3 p-3 ${tile ? "md:flex-1 md:flex-col md:gap-0 md:p-0" : ""}`}>
        <div className={`h-24 w-24 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 ${tile ? "md:aspect-[16/10] md:h-auto md:w-full md:rounded-none md:ring-0" : ""}`}>
          <EventCover src={event.cover_url} title={event.title} />
        </div>
        <div className={`min-w-0 flex-1 pr-8 ${tile ? "md:p-4 md:pr-4" : ""}`}>
          <p className="text-xs font-medium text-accent">{formatEventDate(event.starts_at)}</p>
          <h3 className={`mt-0.5 line-clamp-2 font-semibold leading-snug tracking-tight ${cancelled ? "text-muted line-through" : ""}`}>
            {event.title}
          </h3>
          {event.organiser && (
            <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
              {event.organiser.name}
              {event.organiser.is_verified && <VerifiedMark className="h-3.5 w-3.5 text-[8px]" />}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {cancelled && <Badge tone="danger">Cancelled</Badge>}
            {registration && <RegistrationBadge status={registration} />}
            {price && <Badge tone={price === "Free" ? "success" : "neutral"}>{price}</Badge>}
            <Badge>{event.format === "in_person" ? (event.venue_name ?? FORMAT_LABELS.in_person) : FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS]}</Badge>
            {left !== null && left <= 10 && !cancelled && (
              <Badge tone={left === 0 ? "danger" : "warning"}>{left === 0 ? "Full" : `${left} left`}</Badge>
            )}
          </div>
        </div>
      </Link>

      <div className="absolute right-3 top-3">
        {saved !== undefined && <SaveButton eventId={event.id} saved={saved} />}
      </div>

      {(reason || deadline || actions) && (
        <div className="flex items-center justify-between gap-2 border-t border-white/[0.07] px-3 py-2.5 text-xs">
          <span className="min-w-0 truncate text-muted">
            {reason ? <><span className="text-accent">✦</span> {reason}</> : deadline}
          </span>
          {actions}
        </div>
      )}
    </article>
  );
}
