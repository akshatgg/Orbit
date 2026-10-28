import { requireProfile } from "@/lib/auth";
import { buildIcs } from "@/lib/calendar";
import { formatEventLocation } from "@/lib/discovery/export";
import { listMyCalendar } from "@/lib/discovery/queries";

/** Upcoming saved + registered events as an .ics file (opens in Apple / Google / Outlook). */
export async function GET(request: Request) {
  await requireProfile();
  const now = new Date();
  const entries = await listMyCalendar({ from: now });
  const origin = new URL(request.url).origin;

  const ics = buildIcs(
    entries
      .filter((e) => e.event.status === "published")
      .map(({ event }) => ({
        id: event.id,
        title: event.title,
        description: event.summary,
        starts_at: event.starts_at,
        ends_at: event.ends_at,
        location: formatEventLocation(event),
        url: `${origin}/events/${event.id}`,
      })),
    now,
  );

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orbit-events.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
