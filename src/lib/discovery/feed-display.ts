// Pure helpers for how the For You feed presents itself: reason copy and the diary-style day groups.

import { dayKey } from "@/lib/format";
import { addDays, formatMonth, weekdayIndex } from "./dates";

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

/**
 * Diary heading for an event day: Today / Tomorrow / This week / Next week, then the month.
 * Weeks run Monday to Sunday in UK time.
 */
export function dayGroupLabel(startsAt: string | Date, now: Date): string {
  const day = dayKey(startsAt);
  const today = dayKey(now);
  if (day === today) return "Today";
  if (day === addDays(today, 1)) return "Tomorrow";
  const weekStart = addDays(today, -weekdayIndex(today));
  const nextWeekStart = addDays(weekStart, 7);
  if (day < nextWeekStart) return "This week";
  if (day < addDays(weekStart, 14)) return "Next week";
  return formatMonth(day.slice(0, 7));
}

/** Groups chronologically, keeping the order of first appearance (input should be sorted by start). */
export function groupByDayLabel<T extends { starts_at: string }>(items: T[], now: Date): { label: string; items: T[] }[] {
  const groups: { label: string; items: T[] }[] = [];
  for (const item of items) {
    const label = dayGroupLabel(item.starts_at, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
