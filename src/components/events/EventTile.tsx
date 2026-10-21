import Link from "next/link";
import type { RegistrationStatus } from "@/types/database";
import type { EventCardData } from "@/lib/events/queries";
import type { EventCounts } from "@/lib/events/spots";
import { spotsLeft } from "@/lib/events/spots";
import { seriesHint } from "@/lib/events/series";
import { formatEventDate, formatPrice } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedMark } from "@/components/ui/Badge";
import { EventCover } from "./EventCover";
import { STATUS_PILL, eventPlace } from "./EventRow";
import { SaveButton } from "./SaveButton";

/**
 * An event as a grid card for tablets and laptops (Eventbrite style): a wide cover, then the title,
 * when, where, the price when we know it, and the host.
 */
export function EventTile({ event, registration, saved }: {
  event: EventCardData & { counts?: EventCounts };
  registration?: RegistrationStatus;
  saved?: boolean;
}) {
  const status = registration ? STATUS_PILL[registration] : undefined;
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const left = event.counts ? spotsLeft(event, event.counts) : null;
  const cancelled = event.status === "cancelled";
  const note = cancelled ? "Cancelled" : left === 0 ? "Full" : left !== null && left <= 10 ? "Almost full" : null;
  return (
    <article className="group relative">
      <Link href={`/events/${event.id}`} className="block rounded-[20px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[18px] ring-1 ring-ink/10">
          <EventCover src={event.cover_url} title={event.title} width={640} className="transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
          {status && (
            <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none shadow-sm ${status.className}`}>{status.label}</span>
          )}
          {note && (
            <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-semibold leading-none text-white backdrop-blur">{note}</span>
          )}
        </div>
        <div className="space-y-1 px-0.5 pt-3">
          <h3 className={`line-clamp-2 text-[15.5px] font-semibold leading-snug tracking-tight ${cancelled ? "text-muted line-through" : ""}`}>{event.title}</h3>
          <p className="text-[13px] font-medium text-accent">
            {formatEventDate(event.starts_at)}
            <span className="font-normal text-muted">{seriesHint(event)}</span>
          </p>
          <p className="truncate text-[13px] text-muted">{eventPlace(event).text}</p>
          {price && <p className="text-[13px] font-semibold">{price === "Free" ? "Free" : `From ${price.split(" – ")[0]}`}</p>}
          {event.organiser && (
            <p className="flex items-center gap-1.5 pt-1 text-xs text-muted">
              <Avatar src={event.organiser.logo_url} name={event.organiser.name} size={18} />
              <span className="truncate">{event.organiser.name}</span>
              {event.organiser.is_verified && <VerifiedMark className="h-3.5 w-3.5 shrink-0 text-[8px]" />}
            </p>
          )}
        </div>
      </Link>
      {saved !== undefined && (
        <div className={`absolute right-2.5 top-2.5 transition-opacity duration-200 ${saved ? "" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"}`}>
          <SaveButton eventId={event.id} saved={saved} />
        </div>
      )}
    </article>
  );
}
