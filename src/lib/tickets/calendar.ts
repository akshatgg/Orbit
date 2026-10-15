import type { CalendarEvent } from "@/lib/calendar";

type EventLike = {
  id: string;
  title: string;
  summary: string | null;
  starts_at: string;
  ends_at: string | null;
  format: string;
  venue_name: string | null;
  address: string | null;
  city: string | null;
};

/** The public URL of the app, e.g. for share links and calendar entries. */
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** "Venue, address" or "Online" — one line for calendars. */
export function locationLine(e: EventLike) {
  const place = [e.venue_name, e.address].filter(Boolean).join(", ");
  if (e.format === "online") return "Online";
  return place || e.city || null;
}

export function toCalendarEvent(e: EventLike, origin = appUrl()): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    description: e.summary,
    starts_at: e.starts_at,
    ends_at: e.ends_at,
    location: locationLine(e),
    url: `${origin}/events/${e.id}`,
  };
}
