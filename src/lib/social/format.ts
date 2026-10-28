// Display helpers for the social screens (safe on the server and in the browser).

import type { SocialUser } from "@/types/social";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });
const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" });
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Europe/London" });
const longDayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

/** "now", "5m", "3h", "Tue", "12 Oct". */
export function timeAgo(iso: string, now = new Date()) {
  const date = new Date(iso);
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 6 * 86_400) return weekdayFmt.format(date);
  return dayFmt.format(date);
}

/** "18:04" in UK time. */
export function clockTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

export function sameDay(a: string, b: string) {
  return dayKeyFmt.format(new Date(a)) === dayKeyFmt.format(new Date(b));
}

/** "Today", "Yesterday", "Tuesday 14 October". */
export function dayLabel(iso: string, now = new Date()) {
  const key = dayKeyFmt.format(new Date(iso));
  if (key === dayKeyFmt.format(now)) return "Today";
  if (key === dayKeyFmt.format(new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return longDayFmt.format(new Date(iso));
}

export function displayName(user: Pick<SocialUser, "full_name"> | null | undefined, fallback = "Someone") {
  return user?.full_name?.trim() || fallback;
}

export function firstName(user: Pick<SocialUser, "full_name"> | null | undefined, fallback = "Someone") {
  return displayName(user, fallback).split(/\s+/)[0];
}

/** "Priya", "Priya and Sam", "Priya, Sam and 3 others" (`total` when the list is a capped sample). */
export function namesLine(users: Pick<SocialUser, "full_name">[], limit = 2, total = users.length) {
  const names = users.map((u) => firstName(u));
  const count = Math.max(total, names.length);
  if (count <= limit) return count === 2 ? `${names[0]} and ${names[1]}` : names.join("");
  const shown = names.slice(0, limit);
  const rest = count - shown.length;
  return `${shown.join(", ")} and ${rest} other${rest === 1 ? "" : "s"}`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
