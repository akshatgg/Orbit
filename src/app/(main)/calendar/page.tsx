import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { buttonClass, ButtonLink } from "@/components/ui/Button";
import { FeedTabs } from "@/components/nav/FeedTabs";
import { EventCard } from "@/components/events/EventCard";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";
import { Badge } from "@/components/ui/Badge";
import { CalendarMonth, type DayMarks } from "@/components/discovery/CalendarMonth";
import { CalendarSkeleton, DiscoveryHeader, ICONS, SectionHeading } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import { dayKey, formatTimeRange } from "@/lib/format";
import { formatDayKey, formatMonth, isDayKey, isMonthKey, monthKeyOf, monthRange } from "@/lib/discovery/dates";
import { getViewer, listMyCalendar, type CalendarEntry } from "@/lib/discovery/queries";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <>
      <DiscoveryHeader
        title="Calendar"
        subtitle="Your saved and registered events by day"
        action={
          <a
            href="/calendar/export.ics"
            download="orbit.ics"
            className={buttonClass({ variant: "secondary", size: "sm", className: "rounded-full" })}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={ICONS.download} />
            </svg>
            Export to calendar
          </a>
        }
      />
      <FeedTabs />
      <Suspense fallback={<CalendarSkeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function Calendar({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  const profile = await requireProfile();
  const params = await searchParams;
  const now = new Date();
  const today = dayKey(now);

  const dayParam = first(params.day);
  const monthParam = first(params.month);
  const month = isMonthKey(monthParam) ? monthParam : isDayKey(dayParam) ? dayParam.slice(0, 7) : monthKeyOf(now);

  const viewer = await getViewer(profile);
  const range = monthRange(month);
  const entries = await listMyCalendar(viewer, { from: range.start, to: range.end });

  const byDay = new Map<string, CalendarEntry[]>();
  const marks = new Map<string, DayMarks>();
  for (const e of entries) {
    const key = dayKey(e.event.starts_at);
    byDay.set(key, [...(byDay.get(key) ?? []), e]);
    const m = marks.get(key) ?? { registered: 0, saved: 0 };
    if (e.registration) m.registered += 1;
    else m.saved += 1;
    marks.set(key, m);
  }

  // Selected day: the one asked for, else today (this month), else the first day with something on.
  const selected =
    isDayKey(dayParam) && dayParam.startsWith(month)
      ? dayParam
      : today.startsWith(month)
        ? today
        : ([...byDay.keys()].sort()[0] ?? null);
  const dayEntries = selected ? (byDay.get(selected) ?? []) : [];
  const later = entries.filter((e) => {
    const k = dayKey(e.event.starts_at);
    return k !== selected && k >= (selected ?? "") && k >= today;
  });

  return (
    <div className="space-y-8">
      <div className="px-4">
        <CalendarMonth month={month} today={today} selected={selected} marks={marks} />
      </div>

      {selected && (
        <section aria-labelledby="day-heading" aria-live="polite">
          <SectionHeading
            id="day-heading"
            eyebrow={selected === today ? "Today" : selected < today ? "Past" : "Coming up"}
            title={formatDayKey(selected)}
            count={dayEntries.length || undefined}
          />
          {dayEntries.length ? (
            <ul className="space-y-3 px-4">
              {dayEntries.map((e) => (
                <li key={e.event.id}>
                  <EventCard
                    event={e.event}
                    counts={e.event.counts}
                    saved={e.saved}
                    registration={e.registration}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mx-4 rounded-2xl border border-dashed border-line px-5 py-6 text-center text-sm text-muted">
              Nothing saved for this day.{" "}
              <Link href="/search" className="font-semibold text-gradient">Find something</Link>
            </div>
          )}
        </section>
      )}

      {later.length > 0 && (
        <section aria-labelledby="later-heading">
          <SectionHeading id="later-heading" eyebrow={formatMonth(month)} title="Later this month" count={later.length} />
          <ul className="mx-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {later.map((e) => (
              <li key={e.event.id}>
                <Link
                  href={`/calendar?month=${month}&day=${dayKey(e.event.starts_at)}`}
                  scroll={false}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-surface-2"
                >
                  <DateChip iso={e.event.starts_at} />
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-medium ${e.event.status === "cancelled" ? "text-muted line-through" : ""}`}>
                      {e.event.title}
                    </p>
                    <p className="text-xs text-muted">{formatTimeRange(e.event.starts_at, e.event.ends_at)}</p>
                  </div>
                  {e.registration ? <RegistrationBadge status={e.registration} /> : <Badge>Saved</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {entries.length === 0 && (
        <div className="mx-4 flex flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-6 text-center">
          <p className="text-sm text-muted">
            Nothing in {formatMonth(month)} yet. Save events or grab tickets and they’ll show up here.
          </p>
          <ButtonLink href="/" size="sm">See your picks</ButtonLink>
        </div>
      )}
    </div>
  );
}

const chipDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone: "Europe/London" });
const chipWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" });

function DateChip({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border border-line bg-surface-2 leading-none">
      <span className="text-[9px] font-semibold uppercase tracking-widest text-muted">{chipWeekday.format(d)}</span>
      <span className="mt-0.5 font-display text-base font-semibold">{chipDay.format(d)}</span>
    </span>
  );
}
