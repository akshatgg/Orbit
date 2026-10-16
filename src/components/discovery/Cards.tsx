import Link from "next/link";
import type { RegistrationStatus } from "@/types/database";
import { type EventCardData, type EventCounts } from "@/lib/events/queries";
import { FORMAT_LABELS, formatDeadline, formatEventDate, formatPrice } from "@/lib/format";
import { Avatar } from "@/components/ui/Avatar";
import { reasonSegments, reasonTag } from "@/lib/discovery/feed-display";
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

function venueLabel(event: EventCardData) {
  if (event.format === "in_person") return event.venue_name ?? FORMAT_LABELS.in_person;
  return FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS] ?? event.format;
}

function ctaLabel(event: EventCardData, price: string | null) {
  if (event.registration_mode !== "tickets") return "View event";
  return price === "Free" ? "Free ticket" : "Get ticket";
}

/**
 * The first recommendation on For You. One markup, two looks: in dark a full photo card with a frosted
 * info pane; in light a white card with the photo on top and the details below (CSS rearranges it).
 */
export function HeroCard({ event, counts, saved, reason, dismissible }: CardProps) {
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const going = counts?.going ?? 0;
  const tag = reasonTag(reason) ?? event.category?.name ?? null;
  const segments = reasonSegments(reason);
  return (
    <div>
      <article className="group relative isolate h-[400px] overflow-hidden rounded-[28px] md:h-[440px] lg:h-[480px] light:h-auto light:rounded-[24px] light:bg-surface light:shadow-[var(--card-shadow)]">
        <Link href={`/events/${event.id}`} className="block h-full focus-visible:outline-none light:flex light:flex-col">
          <div className="absolute inset-0 overflow-hidden light:relative light:inset-auto light:h-[190px] light:shrink-0 md:light:h-64">
            <EventCover src={event.cover_url} title={event.title} className="transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/15 light:hidden" />
          </div>
          <div className="glass-pane absolute inset-x-2.5 bottom-2.5 rounded-[20px] p-4 lg:inset-x-auto lg:bottom-4 lg:left-4 lg:w-[26rem] light:static light:w-auto light:rounded-none light:p-4">
            {tag && (
              <span className="mb-1 hidden max-w-full items-center truncate rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent light:inline-flex">
                {tag}
              </span>
            )}
            <p className="text-[13px] text-white/75 light:hidden">{formatHeroDate(event.starts_at)}</p>
            <h2 className="mt-1 mb-2.5 line-clamp-3 text-[22px] font-semibold leading-tight tracking-tight lg:text-[28px] light:mb-1.5 light:mt-2 light:text-xl light:font-bold">{event.title}</h2>
            <p className="mb-3 hidden text-[13px] text-muted light:block">
              {formatEventDate(event.starts_at)} · {venueLabel(event)}
            </p>
            <div className="flex items-center gap-2.5 light:justify-between">
              <div className="flex min-w-0 flex-1 items-center gap-2.5 light:hidden">
                {event.organiser && (
                  <>
                    <Avatar src={event.organiser.logo_url} name={event.organiser.name} size={26} />
                    <span className="truncate text-[13px] text-white/80">{event.organiser.name}</span>
                  </>
                )}
              </div>
              <div className="hidden min-w-0 items-center text-[12.5px] text-muted light:flex">
                {going > 0 ? (
                  <>
                    <span aria-hidden className="flex -space-x-2">
                      {["bg-accent/30", "bg-orange/40", "bg-ink/20"].map((c) => (
                        <i key={c} className={`h-6 w-6 rounded-full border-2 border-surface ${c}`} />
                      ))}
                    </span>
                    <span className="ml-2.5">{going} going</span>
                  </>
                ) : (
                  <span className="truncate">{price ?? venueLabel(event)}</span>
                )}
              </div>
              <span className="bg-gradient inline-flex shrink-0 items-center rounded-full px-3.5 py-2 text-[13px] font-semibold text-bg light:rounded-xl light:px-4 light:py-2.5">
                {ctaLabel(event, price)}
              </span>
            </div>
          </div>
        </Link>
        {saved !== undefined && (
          <div className="absolute right-3.5 top-3.5 z-10">
            <SaveButton eventId={event.id} saved={saved} />
          </div>
        )}
      </article>
      {(segments.length > 0 || dismissible) && (
        <div className="flex items-start gap-2 px-1.5 pt-3">
          <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-muted light:hidden">
            {segments.map((seg, i) => (
              <span key={i} className={seg.strong ? "font-medium text-fg" : undefined}>{seg.text}</span>
            ))}
          </p>
          <span className="hidden flex-1 light:block" />
          {dismissible && <NotInterestedButton id={event.id} title={event.title} />}
        </div>
      )}
    </div>
  );
}

const heroDate = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Europe/London" });
/** "Thu 23 Oct, 7:00 pm" */
function formatHeroDate(startsAt: string) {
  return heroDate.format(new Date(startsAt)).replace(/ (am|pm)$/i, (m) => m.toLowerCase());
}

const rowDay = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" });
const rowTime = new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "2-digit", hour12: false, timeZone: "Europe/London" });

/**
 * One row of the mobile "More for you" list. Dark: 72px rounded thumbnail on the left, blue date line.
 * Light: diary row, weekday + time on the left, title and host in the middle, 56px thumbnail on the right.
 */
export function FeedRow({ event, dismissible }: { event: EventCardData; dismissible?: boolean }) {
  const deadline = formatDeadline(event.registration_deadline);
  const closing = deadline && deadline !== "Registration closed" && event.registration_mode !== "none" && /hour|today|\b[1-7] day/.test(deadline) ? deadline : null;
  const start = new Date(event.starts_at);
  const meta = [event.organiser?.name, event.format === "in_person" ? event.venue_name : FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS]].filter(Boolean).join(", ");
  return (
    <div className="relative">
      <Link
        href={`/events/${event.id}`}
        className="flex items-center gap-3.5 py-2.5 pr-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent light:grid light:grid-cols-[3.25rem_minmax(0,1fr)_3.5rem] light:gap-3 light:py-3 light:pr-0"
      >
        <div aria-hidden className="hidden text-[13px] font-semibold leading-tight light:block">
          {rowDay.format(start)}
          <span className="block text-[11.5px] font-normal text-muted">{rowTime.format(start)}</span>
        </div>
        <div className="min-w-0 flex-1 pr-7 light:pr-5">
          <p className="text-xs font-medium text-accent light:hidden">{formatEventDate(event.starts_at)}</p>
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-tight">{event.title}</h3>
          <p className="mt-0.5 truncate text-[12.5px] text-muted">
            {meta}
            {closing && <span className="ml-1.5 hidden font-medium text-orange light:inline">· {closing}</span>}
          </p>
        </div>
        <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl dark:order-first light:h-14 light:w-14 light:rounded-[14px]">
          <EventCover src={event.cover_url} title={event.title} width={200} />
        </div>
      </Link>
      {dismissible && (
        <NotInterestedButton
          id={event.id}
          title={event.title}
          compact
          className="absolute bottom-1.5 right-0 light:right-[4.25rem]"
        />
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
          <p className="text-xs font-medium text-accent">{formatEventDate(event.starts_at)}</p>
          <h3 className="line-clamp-2 min-h-[2.5rem] font-semibold leading-snug tracking-tight">{event.title}</h3>
          <p className="truncate text-xs text-muted">
            {event.organiser?.name ?? venueLabel(event)}
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
