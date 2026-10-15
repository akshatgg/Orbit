import type { EventCardData } from "@/lib/events/queries";

/** "Venue, address, city" for calendar entries; "Online" for online events. */
export function formatEventLocation(e: Pick<EventCardData, "format" | "venue_name" | "address" | "city">): string | null {
  if (e.format === "online") return "Online";
  const parts = [e.venue_name, e.address, e.city].filter((p): p is string => !!p);
  return parts.length ? [...new Set(parts)].join(", ") : null;
}
