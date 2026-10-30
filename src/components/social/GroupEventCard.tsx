import Link from "next/link";
import { EventCover } from "@/components/events/EventCover";
import { eventPlace } from "@/components/events/EventRow";
import { SaveButton } from "@/components/events/SaveButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { formatEventDate, formatPrice, formatTimeRange } from "@/lib/format";
import { unshareEvent } from "@/lib/social/actions";
import { displayName, namesLine, timeAgo } from "@/lib/social/format";
import type { GroupEventItem } from "@/types/social";
import { AvatarStack } from "./AvatarStack";
import { SocialIcon } from "./icons";
import { InterestToggle } from "./InterestToggle";
import { ActionButton } from "./SmallActions";

/** Where "Register" goes: the organiser's own page (through /go, which logs the click), tickets, or the event. */
export function registrationLink(event: GroupEventItem["event"]) {
  if (event.registration_mode === "external" && event.external_url) {
    return { href: `/go/${event.id}`, label: event.external_label?.trim() || "Registration link", external: true };
  }
  if (event.registration_mode === "tickets") return { href: `/events/${event.id}`, label: "Get tickets", external: false };
  return { href: `/events/${event.id}`, label: "View event", external: false };
}

/**
 * An event inside a Circle or Community: the card, who shared it (and their note), who's in, the
 * registration link and — in a circle — "I'm interested" / "Count me in". `inChat` is the same card
 * as a chat message: it adds the short description, and the message's own options do the removing.
 */
export function GroupEventCard({ item, groupId, kind, viewerId, canModerate, saved, past = false, inChat = false, onSaved }: {
  item: GroupEventItem;
  groupId: string;
  kind: "circle" | "community" | "channel";
  viewerId: string;
  canModerate: boolean;
  /** Communities: the viewer's save state (shows the bookmark). */
  saved?: boolean;
  past?: boolean;
  inChat?: boolean;
  onSaved?: (saved: boolean) => void;
}) {
  const { event, shared_by: sharedBy } = item;
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const cancelled = event.status === "cancelled";
  const reg = registrationLink(event);
  const going = item.going ?? [];
  const interested = item.interested ?? [];
  // The lists are capped by the API; the counts are the totals.
  const goingCount = Math.max(item.going_count ?? 0, going.length);
  const interestedCount = Math.max(item.interested_count ?? 0, interested.length);
  const canRemove = !inChat && !!sharedBy && (sharedBy.id === viewerId || canModerate);

  return (
    <article className={`glass relative overflow-hidden rounded-[22px] ${past ? "opacity-80" : ""}`}>
      <Link href={`/events/${event.id}`} className="flex gap-3 p-3 transition-colors hover:bg-ink/[0.03]">
        <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-ink/10">
          <EventCover src={event.cover_url} title={event.title} width={240} />
        </div>
        <div className={`min-w-0 flex-1 ${saved !== undefined ? "pr-9" : ""}`}>
          <p className="text-xs font-medium text-accent">{formatEventDate(event.starts_at)}</p>
          <h3 className={`mt-0.5 line-clamp-2 font-semibold leading-snug tracking-tight ${cancelled ? "text-muted line-through" : ""}`}>{event.title}</h3>
          <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted">
            {event.organiser?.name ?? eventPlace(event).text}
            {event.organiser?.is_verified && <VerifiedMark className="h-3.5 w-3.5 text-[8px]" />}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {cancelled && <Badge tone="danger">Cancelled</Badge>}
            {price && <Badge tone={price === "Free" ? "success" : "neutral"}>{price}</Badge>}
            {event.category && kind !== "circle" && !sharedBy && <Badge>{event.category.name}</Badge>}
          </div>
          {inChat && event.summary && <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted">{event.summary}</p>}
        </div>
      </Link>
      {saved !== undefined && (
        <div className="absolute right-3 top-3">
          <SaveButton eventId={event.id} saved={saved} onSaved={onSaved} />
        </div>
      )}

      <div className="space-y-3 border-t border-ink/[0.07] px-3.5 py-3">
        {sharedBy ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Avatar src={sharedBy.avatar_url} name={displayName(sharedBy)} size={20} />
            <span className="min-w-0 truncate">
              Shared by <span className="font-medium text-fg">{sharedBy.id === viewerId ? "you" : displayName(sharedBy)}</span>
              {item.shared_at && <> · {timeAgo(item.shared_at)}</>}
            </span>
          </p>
        ) : kind !== "circle" ? (
          <p className="text-xs text-muted">{inChat ? "New in this channel" : `Matches this ${kind}`}{event.category ? ` · ${event.category.name}` : ""}</p>
        ) : null}
        {item.note && <p className="rounded-[14px] bg-ink/[0.05] px-3 py-2 text-sm leading-relaxed text-fg/90">{item.note}</p>}

        {(goingCount > 0 || interestedCount > 0) && (
          <div className="flex items-center gap-2.5">
            <AvatarStack users={[...going, ...interested]} total={goingCount + interestedCount} />
            <p className="min-w-0 text-xs leading-snug text-muted">
              {goingCount > 0 && <><span className="font-medium text-fg">{namesLine(going, 2, goingCount)}</span> {goingCount === 1 ? "is" : "are"} in</>}
              {goingCount > 0 && interestedCount > 0 && " · "}
              {interestedCount > 0 && <>{namesLine(interested, 2, interestedCount)} {interestedCount === 1 ? "is" : "are"} interested</>}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {kind === "circle" && !past && !cancelled && <InterestToggle groupId={groupId} eventId={event.id} status={item.my_status} />}
          {!past && !cancelled && (
            reg.external ? (
              <a href={reg.href} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
                {reg.label} <SocialIcon name="external" className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Link href={reg.href} className={buttonClass({ variant: "secondary", size: "sm" })}>{reg.label}</Link>
            )
          )}
          {canRemove && (
            <ActionButton
              action={unshareEvent.bind(null, groupId, event.id)}
              confirm={`Remove “${event.title}” from this ${kind}?`}
              className="ml-auto"
              label="Remove from group"
            >
              Remove
            </ActionButton>
          )}
        </div>
      </div>
    </article>
  );
}

const TZ = "Europe/London";
const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: TZ });
const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: TZ });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TZ });

/**
 * The same event as one compact row of a community's list view (inside a divided `glass` list):
 * the date, title, time and place, price, then the registration link, Remove and the bookmark.
 */
export function GroupEventRow({ item, groupId, kind, viewerId, canModerate, saved, past = false }: Parameters<typeof GroupEventCard>[0]) {
  const { event, shared_by: sharedBy } = item;
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const cancelled = event.status === "cancelled";
  const reg = registrationLink(event);
  const canRemove = !!sharedBy && (sharedBy.id === viewerId || canModerate);
  const start = new Date(event.starts_at);
  const actions = cancelled || !past || canRemove;

  return (
    <article className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 ${past ? "opacity-80" : ""}`}>
      <time dateTime={event.starts_at} className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-accent/10 leading-none text-accent">
        <span className="text-[10.5px] font-medium">{monthFmt.format(start)}</span>
        <span className="mt-1 text-lg font-semibold tabular-nums">{dayFmt.format(start)}</span>
      </time>
      <Link href={`/events/${event.id}`} className="group/title min-w-0 flex-1 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        <h3 className={`truncate text-[15px] font-semibold leading-snug tracking-tight group-hover/title:underline ${cancelled ? "text-muted line-through" : ""}`}>
          {event.title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-muted">
          {weekdayFmt.format(start)} {formatTimeRange(event.starts_at)} · {eventPlace(event).text}
          {price && <> · <span className="font-semibold text-emerald-400 light:text-emerald-600">{price}</span></>}
        </p>
      </Link>
      {actions && (
        <div className="order-last flex basis-full items-center gap-2 pl-14 sm:order-none sm:basis-auto sm:pl-0">
          {cancelled && <Badge tone="danger">Cancelled</Badge>}
          {!past && !cancelled && (
            reg.external ? (
              <a href={reg.href} target="_blank" rel="noopener noreferrer" className={buttonClass({ variant: "secondary", size: "sm" })}>
                {reg.label} <SocialIcon name="external" className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Link href={reg.href} className={buttonClass({ variant: "secondary", size: "sm" })}>{reg.label}</Link>
            )
          )}
          {canRemove && (
            <ActionButton
              action={unshareEvent.bind(null, groupId, event.id)}
              confirm={`Remove “${event.title}” from this ${kind}?`}
              label="Remove from group"
            >
              Remove
            </ActionButton>
          )}
        </div>
      )}
      {saved !== undefined && <SaveButton eventId={event.id} saved={saved} />}
    </article>
  );
}
