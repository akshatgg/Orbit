import Link from "next/link";
import type { RegistrationStatus } from "@/types/database";
import type { EventCardData } from "@/lib/events/queries";
import { spotsLeft, type EventCounts } from "@/lib/events/spots";
import { seriesHint } from "@/lib/events/series";
import { FORMAT_LABELS, formatDeadline, formatEventDate, formatPrice, formatTimeRange } from "@/lib/format";
import { groupByDay } from "@/lib/discovery/feed-display";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedMark } from "@/components/ui/Badge";
import { Dismissible, NotInterestedButton } from "@/components/discovery/Dismiss";
import { EventCover } from "./EventCover";

export type EventRowItem = {
  event: EventCardData & { counts?: EventCounts };
  registration?: RegistrationStatus;
};

export const ICON = {
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  video: "M15 10.5 20 7v10l-5-3.5M5 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z",
};

function Icon({ path }: { path: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-subtle" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

/** The pill on the cover: where the viewer stands with this event. */
export const STATUS_PILL: Partial<Record<RegistrationStatus, { label: string; className: string }>> = {
  going: { label: "Going", className: "bg-emerald-500 text-white" },
  pending: { label: "Pending", className: "bg-orange text-white" },
  waitlisted: { label: "Waitlist", className: "bg-sky-500 text-white" },
  awaiting_payment: { label: "Pay now", className: "bg-orange text-white" },
};

/** One short status note after the time, most important first: cancelled, full, nearly full, closing. */
function flag(event: EventRowItem["event"]): { text: string; className: string } | null {
  if (event.status === "cancelled") return { text: "Cancelled", className: "text-red-400" };
  const left = event.counts ? spotsLeft(event, event.counts) : null;
  if (left === 0) return { text: "Full", className: "text-red-400" };
  if (left !== null && left <= 10) return { text: "Near capacity", className: "text-orange" };
  const deadline = formatDeadline(event.registration_deadline);
  if (deadline && event.registration_mode !== "none" && /hour|\b[1-3] days?\b/.test(deadline)) {
    return { text: deadline, className: "text-orange" };
  }
  return null;
}

/** Where the event is, with its icon: "Venue, City", or "Online". */
export function eventPlace(event: EventCardData) {
  if (event.format === "online") return { icon: ICON.video, text: FORMAT_LABELS.online };
  const where = [event.venue_name, event.city && !event.venue_name?.includes(event.city) ? event.city : null].filter(Boolean).join(", ");
  const text = where || FORMAT_LABELS.in_person;
  return { icon: ICON.pin, text: event.format === "hybrid" ? `${text} · Online too` : text };
}

/**
 * An event as one list row (Luma style): cover on the left with the viewer's ticket status, then the host
 * (and the price, when known), the title, the time and the place. `showDate` adds the day to the time (for lists not grouped by day).
 */
export function EventRow({ event, registration, showDate = true, dismissible }: EventRowItem & {
  showDate?: boolean;
  /** Show "Not interested" (needs a surrounding <DismissProvider>). */
  dismissible?: boolean;
}) {
  const status = registration ? STATUS_PILL[registration] : undefined;
  const note = flag(event);
  // Shown only when we know it: "Free", "£70", "£5 – £15". Unknown prices stay blank.
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const where = eventPlace(event);
  const cancelled = event.status === "cancelled";
  return (
    <div className="relative">
      <Link
        href={`/events/${event.id}`}
        className="flex gap-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <div className="relative h-[76px] w-[76px] shrink-0">
          <div className="h-full w-full overflow-hidden rounded-[14px] ring-1 ring-ink/10">
            <EventCover src={event.cover_url} title={event.title} width={200} />
          </div>
          {status && (
            <span className={`absolute -bottom-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-[3px] text-[10.5px] font-semibold leading-none shadow-sm ring-2 ring-bg ${status.className}`}>
              {status.label}
            </span>
          )}
        </div>

        <div className={`min-w-0 flex-1 ${dismissible ? "pr-7" : ""}`}>
          <div className="flex items-center gap-1.5 text-[12.5px] text-muted">
            {event.organiser && (
              <>
                <Avatar src={event.organiser.logo_url} name={event.organiser.name} size={16} />
                <span className="min-w-0 truncate">{event.organiser.name}</span>
                {event.organiser.is_verified && <VerifiedMark className="h-3.5 w-3.5 shrink-0 text-[8px]" />}
              </>
            )}
            {price && <span className="ml-auto shrink-0 pl-1 text-[11.5px] font-semibold text-emerald-400 light:text-emerald-600">{price}</span>}
          </div>
          <h3 className={`mt-0.5 line-clamp-2 text-[15.5px] font-semibold leading-snug tracking-tight ${cancelled ? "text-muted line-through" : ""}`}>
            {event.title}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon path={ICON.clock} />
            <span className="min-w-0 truncate">
              {showDate ? formatEventDate(event.starts_at) : formatTimeRange(event.starts_at)}
              {note && <span className={`font-medium ${note.className}`}> · {note.text}</span>}
              {seriesHint(event)}
            </span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
            <Icon path={where.icon} />
            <span className="min-w-0 truncate">{where.text}</span>
          </p>
        </div>
      </Link>
      {dismissible && <NotInterestedButton id={event.id} title={event.title} className="absolute -right-1.5 top-1.5 opacity-70" />}
    </div>
  );
}

/**
 * Events as a list of rows, with hairlines between them. `groupBy="day"` puts them under day headings
 * ("Tomorrow / Thursday", "24 October / Saturday"); the items must then be sorted by start time.
 */
export function EventRows({ items, groupBy, showDate = true, now = new Date(), dismissible, className = "" }: {
  items: EventRowItem[];
  groupBy?: "day";
  /** Ungrouped lists only: false when every event is on a day the page already names. */
  showDate?: boolean;
  now?: Date;
  dismissible?: boolean;
  className?: string;
}) {
  const list = (rows: EventRowItem[], showDate: boolean) => (
    <ul>
      {rows.map((item) => {
        const row = (
          <li key={item.event.id} className="group/row relative">
            <span aria-hidden className="absolute left-[calc(76px+0.875rem)] right-0 top-0 h-px bg-line group-first/row:hidden" />
            <EventRow {...item} showDate={showDate} dismissible={dismissible} />
          </li>
        );
        return dismissible ? <Dismissible key={item.event.id} id={item.event.id}>{row}</Dismissible> : row;
      })}
    </ul>
  );

  if (groupBy !== "day") return <div className={className}>{list(items, showDate)}</div>;
  const days = groupByDay(items.map((item) => ({ ...item, starts_at: item.event.starts_at })), now);
  return (
    <div className={className}>
      {days.map((day) => (
        <section key={day.key} aria-label={`${day.title}, ${day.weekday}`} className="pt-4 first:pt-0">
          <h3 className="text-[15px] font-semibold tracking-tight">
            {day.title} <span className="font-normal text-muted">/ {day.weekday}</span>
          </h3>
          {list(day.items, false)}
        </section>
      ))}
    </div>
  );
}
