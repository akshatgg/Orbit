// "Add to calendar" helpers: Google Calendar link and a standard .ics file (Apple / Outlook).

export type CalendarEvent = {
  id: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at?: string | null;
  location?: string | null;
  url?: string | null;
};

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function endOf(e: CalendarEvent) {
  return e.ends_at ? new Date(e.ends_at) : new Date(new Date(e.starts_at).getTime() + 60 * 60 * 1000);
}

export function googleCalendarUrl(e: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(new Date(e.starts_at))}/${stamp(endOf(e))}`,
    details: [e.description, e.url].filter(Boolean).join("\n\n"),
    location: e.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (m) => `\\${m}`);

/** Folds lines longer than 75 octets as RFC 5545 requires. */
const fold = (line: string) => line.match(/.{1,74}/g)!.join("\r\n ");

export function buildIcs(events: CalendarEvent[], now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ORBIT//Explore Opportunities//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@orbit`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(new Date(e.starts_at))}`,
      `DTEND:${stamp(endOf(e))}`,
      fold(`SUMMARY:${escapeIcs(e.title)}`),
    );
    if (e.description) lines.push(fold(`DESCRIPTION:${escapeIcs(e.description)}`));
    if (e.location) lines.push(fold(`LOCATION:${escapeIcs(e.location)}`));
    if (e.url) lines.push(fold(`URL:${e.url}`));
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
