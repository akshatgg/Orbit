// iCal (RFC 5545) → NormalizedEvent[]. Pure: no network, so it's easy to test with fixtures.

import ICAL from "ical.js";
import type { EventFormat } from "@/types/database";
import { LIMITS, clamp, cleanProse, oneLine, orNull, safeHttpUrl, stripHtml, summarise } from "./text";
import { DEFAULT_TIMEZONE, isValidTimezone, zonedTimeToUtc } from "./timezone";
import type { ConnectorResult, NormalizedEvent, RunError } from "./types";

type IcalTime = InstanceType<typeof ICAL.Time>;
type IcalEvent = InstanceType<typeof ICAL.Event>;
type IcalComponent = InstanceType<typeof ICAL.Component>;

export type IcalParseOptions = {
  now: Date;
  /** How far ahead recurring events are expanded. */
  recurrenceDays?: number;
  /** Max occurrences kept per recurring event. */
  maxOccurrences?: number;
  /** One-off events further ahead than this are ignored. */
  horizonDays?: number;
  /** Hard cap on events per feed. */
  maxEvents?: number;
  /** Zone for floating times when the feed doesn't say (X-WR-TIMEZONE). */
  defaultTimezone?: string;
};

export const ICAL_DEFAULTS = {
  recurrenceDays: 60,
  maxOccurrences: 30,
  horizonDays: 365,
  maxEvents: 2000,
} as const;

/** Safety net for rules like FREQ=MINUTELY that started years ago. */
const MAX_ITERATIONS = 20000;
const DAY = 24 * 60 * 60 * 1000;

/** True when ical.js resolved the time to a real zone (UTC or a VTIMEZONE in the file). */
function hasResolvedZone(t: IcalTime) {
  const zone = t.zone;
  return Boolean(zone && zone !== ICAL.Timezone.localTimezone && zone.tzid !== "floating");
}

function toInstant(t: IcalTime, tz: string): Date {
  if (t.isDate) return zonedTimeToUtc({ year: t.year, month: t.month, day: t.day }, tz);
  if (hasResolvedZone(t)) return new Date(t.toUnixTime() * 1000);
  return zonedTimeToUtc(
    { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
    tz,
  );
}

/** The zone this event was written in: its TZID if we know it, else the calendar's. */
function eventTimezone(event: IcalEvent, calendarTz: string) {
  const tzid = event.component.getFirstProperty("dtstart")?.getParameter("tzid");
  const raw: unknown = Array.isArray(tzid) ? tzid[0] : tzid;
  if (typeof raw === "string") {
    const id: string = raw;
    if (isValidTimezone(id)) return id;
    // Some producers prefix IANA names, e.g. "/mozilla.org/20050126_1/Europe/London".
    const tail = String(raw).split("/").slice(-2).join("/");
    if (isValidTimezone(tail)) return tail;
  }
  return calendarTz;
}

function textProp(component: IcalComponent, name: string): string | null {
  const value = component.getFirstPropertyValue(name);
  return typeof value === "string" ? value : null;
}

const ONLINE_HINT = /\b(online|virtual|zoom|teams|google meet|webinar)\b/i;

function splitLocation(location: string | null): { venueName: string | null; address: string | null; format: EventFormat } {
  const text = oneLine(location);
  if (!text) return { venueName: null, address: null, format: "in_person" };
  // A bare link (often a meeting URL) — never publish it; just mark the event as online.
  if (/^https?:\/\//i.test(text)) return { venueName: "Online", address: null, format: "online" };
  if (/^(online|virtual|zoom|microsoft teams|teams|google meet)$/i.test(text)) {
    return { venueName: "Online", address: null, format: "online" };
  }
  const comma = text.indexOf(",");
  const venue = comma > 0 ? text.slice(0, comma).trim() : text;
  const address = comma > 0 ? text.slice(comma + 1).trim() : "";
  return {
    venueName: orNull(clamp(venue, LIMITS.venue)),
    address: orNull(clamp(address, LIMITS.address)),
    format: ONLINE_HINT.test(text) && comma < 0 ? "online" : "in_person",
  };
}

/** Small stable hash, used only when a feed omits UIDs. */
export function stableHash(input: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** GEO is a structured `lat;lon` value in iCal. Missing or nonsensical points are dropped. */
function geoPoint(component: IcalComponent): { latitude: number | null; longitude: number | null } {
  const value: unknown = component.getFirstPropertyValue("geo");
  const pair = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[;,]/) : [];
  const latitude = Number(pair[0]);
  const longitude = Number(pair[1]);
  if (
    pair.length < 2 ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function baseUid(component: IcalComponent) {
  const uid = textProp(component, "uid")?.trim();
  if (uid) return uid.slice(0, 400);
  const start = component.getFirstPropertyValue("dtstart");
  return `nouid-${stableHash(`${textProp(component, "summary") ?? ""}|${start?.toString() ?? ""}`)}`;
}

/** iCal-style key for an occurrence, e.g. "20261020T180000Z" or "20261020" for all-day. */
function occurrenceKey(t: IcalTime) {
  const s = (hasResolvedZone(t) && !t.isDate ? t.convertToZone(ICAL.Timezone.utcTimezone) : t).toICALString();
  return s;
}

function normalise(
  item: IcalEvent,
  start: IcalTime,
  end: IcalTime | null,
  sourceEventId: string,
  calendarTz: string,
): NormalizedEvent | RunError {
  const title = clamp(oneLine(item.summary), LIMITS.title);
  if (title.length < 3) return { event: sourceEventId, message: "Skipped: title is missing or too short" };

  const tz = eventTimezone(item, calendarTz);
  const allDay = start.isDate;
  const startsAt = toInstant(start, tz);
  let endsAt: Date | null = end ? toInstant(end, tz) : null;
  if (allDay && endsAt) endsAt = new Date(endsAt.getTime() - 60 * 1000); // DTEND is exclusive → 23:59 of the last day
  if (endsAt && endsAt.getTime() <= startsAt.getTime()) endsAt = allDay ? new Date(startsAt.getTime() + DAY - 60000) : null;
  if (Number.isNaN(startsAt.getTime())) return { event: sourceEventId, message: "Skipped: invalid start date" };

  const description = orNull(clamp(cleanProse(stripHtml(item.description)), LIMITS.description));
  const { venueName, address, format } = splitLocation(item.location);
  const { latitude, longitude } = geoPoint(item.component);
  const status = textProp(item.component, "status")?.toUpperCase();

  return {
    sourceEventId,
    title,
    summary: summarise(description),
    description,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt ? endsAt.toISOString() : null,
    allDay,
    timezone: tz,
    format,
    venueName,
    address,
    city: null,
    latitude,
    longitude,
    url: safeHttpUrl(textProp(item.component, "url")),
    cancelled: status === "CANCELLED",
  };
}

const isError = (x: NormalizedEvent | RunError): x is RunError => "message" in x;

/**
 * Parses an iCal feed. One-off events that haven't ended (within `horizonDays`) are kept;
 * recurring events are expanded over the next `recurrenceDays` with one id per occurrence.
 * Throws when the text isn't iCal at all.
 */
export function parseIcal(text: string, options: IcalParseOptions): ConnectorResult {
  const opts = { ...ICAL_DEFAULTS, ...options };
  const now = opts.now.getTime();
  const singleHorizon = now + opts.horizonDays * DAY;
  const recurrenceEnd = now + opts.recurrenceDays * DAY;

  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("This doesn't look like an iCal feed (no BEGIN:VCALENDAR).");
  let jcal: unknown;
  try {
    jcal = ICAL.parse(text);
  } catch (e) {
    throw new Error(`Couldn't read the iCal feed: ${e instanceof Error ? e.message : String(e)}`);
  }
  const root = Array.isArray(jcal) && Array.isArray(jcal[0]) ? jcal[0] : jcal;
  const calendar = new ICAL.Component(root as unknown[]);

  const wrTz = textProp(calendar, "x-wr-timezone");
  const calendarTz = isValidTimezone(wrTz) ? wrTz : isValidTimezone(opts.defaultTimezone) ? opts.defaultTimezone : DEFAULT_TIMEZONE;

  const events: NormalizedEvent[] = [];
  const errors: RunError[] = [];
  const seen = new Set<string>();

  const push = (result: NormalizedEvent | RunError) => {
    if (isError(result)) {
      errors.push(result);
      return;
    }
    if (seen.has(result.sourceEventId)) return;
    seen.add(result.sourceEventId);
    events.push(result);
  };

  // Group VEVENTs: masters by UID, and their modified occurrences (RECURRENCE-ID).
  const masters = new Map<string, IcalComponent>();
  const exceptions = new Map<string, IcalComponent[]>();
  for (const vevent of calendar.getAllSubcomponents("vevent")) {
    const uid = baseUid(vevent);
    if (vevent.hasProperty("recurrence-id")) {
      exceptions.set(uid, [...(exceptions.get(uid) ?? []), vevent]);
    } else if (!masters.has(uid)) {
      masters.set(uid, vevent);
    }
  }

  for (const [uid, component] of masters) {
    if (events.length >= opts.maxEvents) break;
    try {
      const event = new ICAL.Event(component, { exceptions: exceptions.get(uid) ?? [], strictExceptions: false });
      exceptions.delete(uid);
      if (!event.startDate) {
        errors.push({ event: uid, message: "Skipped: no start date" });
        continue;
      }
      const tz = eventTimezone(event, calendarTz);

      if (!event.isRecurring()) {
        const start = toInstant(event.startDate, tz).getTime();
        const end = toInstant(event.endDate, tz).getTime();
        if (Math.max(start, end) < now || start > singleHorizon) continue;
        push(normalise(event, event.startDate, event.endDate, uid, calendarTz));
        continue;
      }

      const iterator = event.iterator();
      let kept = 0;
      for (let i = 0, next = iterator.next(); next && i < MAX_ITERATIONS; i++, next = iterator.next()) {
        const occurrenceStart = toInstant(next, tz).getTime();
        if (occurrenceStart > recurrenceEnd) break;
        const details = event.getOccurrenceDetails(next);
        const endMs = toInstant(details.endDate, tz).getTime();
        if (Math.max(occurrenceStart, endMs) < now) continue;
        push(normalise(details.item, details.startDate, details.endDate, `${uid}#${occurrenceKey(details.recurrenceId)}`, calendarTz));
        if (++kept >= opts.maxOccurrences || events.length >= opts.maxEvents) break;
      }
    } catch (e) {
      errors.push({ event: uid, message: `Skipped: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  // Modified occurrences whose series isn't in the feed: treat each as a one-off.
  for (const [uid, list] of exceptions) {
    for (const component of list) {
      if (events.length >= opts.maxEvents) break;
      try {
        const event = new ICAL.Event(component);
        const tz = eventTimezone(event, calendarTz);
        const start = toInstant(event.startDate, tz).getTime();
        const end = toInstant(event.endDate, tz).getTime();
        if (Math.max(start, end) < now || start > singleHorizon) continue;
        push(normalise(event, event.startDate, event.endDate, `${uid}#${occurrenceKey(event.recurrenceId)}`, calendarTz));
      } catch (e) {
        errors.push({ event: uid, message: `Skipped: ${e instanceof Error ? e.message : String(e)}` });
      }
    }
  }

  events.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { events, errors };
}
