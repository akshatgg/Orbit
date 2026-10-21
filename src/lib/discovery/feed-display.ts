// Pure helpers for how the For You feed presents itself: reason copy and the day headings of event lists.

import { dayKey } from "@/lib/format";
import { addDays } from "./dates";

export type ReasonSegment = { text: string; strong: boolean };

const REASON_PREFIX = /^Recommended because /;
const CLAUSE = /^(you're into|you enjoy|you like|you follow|you're free on|it's aimed at|it's for)\s+(.+)$/;

/** "Recommended because you like socials" -> "you like socials" (null when there is no reason). */
export function reasonBody(reason: string | null | undefined): string | null {
  if (!reason) return null;
  const body = reason.replace(REASON_PREFIX, "").trim();
  return body || null;
}

/** "Picked because you like [socials]": the key words are flagged `strong` so the UI can lift them. */
export function reasonSegments(reason: string | null | undefined): ReasonSegment[] {
  const body = reasonBody(reason);
  if (!body) return [];
  const segments: ReasonSegment[] = [{ text: "Picked because ", strong: false }];
  body.split(" and ").forEach((clause, i) => {
    if (i > 0) segments.push({ text: " and ", strong: false });
    const m = clause.match(CLAUSE);
    if (m) {
      segments.push({ text: `${m[1]} `, strong: false }, { text: m[2], strong: true });
    } else {
      segments.push({ text: clause, strong: false });
    }
  });
  return segments;
}

/** Short chip for the light hero: "Matches your interest in consulting". */
export function reasonTag(reason: string | null | undefined): string | null {
  const body = reasonBody(reason);
  if (!body) return null;
  const first = body.split(" and ")[0];
  const interest = first.match(/^(?:you're into|you enjoy)\s+(.+)$/);
  if (interest) return `Matches your interest in ${interest[1]}`;
  const like = first.match(/^you like\s+(.+)$/);
  if (like) return `Matches your taste for ${like[1]}`;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

const headingDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
const headingWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" });

export type DayHeading = { key: string; title: string; weekday: string };

/** Heading for an event's day, in UK time: "Today", "Tomorrow", else "24 October"; plus the weekday. */
export function dayHeading(startsAt: string | Date, now: Date): DayHeading {
  const key = dayKey(startsAt);
  const today = dayKey(now);
  const noon = new Date(`${key}T12:00:00Z`);
  const title = key === today ? "Today" : key === addDays(today, 1) ? "Tomorrow" : headingDate.format(noon);
  return { key, title, weekday: headingWeekday.format(noon) };
}

/** Groups events by day, keeping the order of first appearance (input should be sorted by start). */
export function groupByDay<T extends { starts_at: string }>(items: T[], now: Date): (DayHeading & { items: T[] })[] {
  const groups: (DayHeading & { items: T[] })[] = [];
  for (const item of items) {
    const heading = dayHeading(item.starts_at, now);
    const last = groups[groups.length - 1];
    if (last && last.key === heading.key) last.items.push(item);
    else groups.push({ ...heading, items: [item] });
  }
  return groups;
}
