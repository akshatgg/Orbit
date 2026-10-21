import "server-only";
import { cache } from "react";
import type { Category, Profile, RegistrationStatus } from "@/types/database";
import {
  EVENT_CARD_SELECT, getMyEventState, withCounts, type EventWithCounts, type MyEventState,
} from "@/lib/events/queries";
import { ACTIVE_REGISTRATION, rankEvents, type Scored } from "@/lib/ranking";
import { createClient } from "@/lib/supabase/server";
import { datePresetRange } from "./dates";
import type { SearchFilters } from "./filters";
import { interestTags } from "@/lib/taxonomy";
import { nextOfEachSeries } from "@/lib/events/series";

/** Card columns plus what ranking needs to judge "full without a waitlist". */
const DISCOVERY_SELECT = `${EVENT_CARD_SELECT}, waitlist_enabled`;

export type DiscoveryEvent = EventWithCounts & { waitlist_enabled: boolean };
export type RankedEvent = Scored<DiscoveryEvent>;

const DAY = 864e5;

/** Not ended at `at`: ends later, or (no end time) starts later. */
const notEndedFilter = (at: Date) => {
  const iso = at.toISOString();
  return `ends_at.gte.${iso},and(ends_at.is.null,starts_at.gte.${iso})`;
};

export type Viewer = {
  profile: Profile;
  followedOrganiserIds: Set<string>;
  state: MyEventState;
};

/** Who's looking: follows + saved / dismissed / ticket state. Deduplicated per request. */
export const getViewer = cache(async (profile: Profile): Promise<Viewer> => {
  const supabase = await createClient();
  const [{ data: follows }, state] = await Promise.all([
    supabase.from("follows").select("organiser_id").eq("user_id", profile.id),
    getMyEventState(profile.id),
  ]);
  return {
    profile,
    followedOrganiserIds: new Set((follows ?? []).map((f) => f.organiser_id as string)),
    state,
  };
});

/** Published, not-ended events starting before `to`, with counts. */
export async function listCandidates({ to, now, limit = 200 }: { to: Date; now: Date; limit?: number }) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(DISCOVERY_SELECT)
    .eq("status", "published")
    .is("duplicate_of", null)
    .or(notEndedFilter(now))
    .lt("starts_at", to.toISOString())
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  // A recurring series shows only its next date; the event page lists the rest.
  return (await withCounts(nextOfEachSeries((data ?? []) as unknown as DiscoveryEvent[]))) as DiscoveryEvent[];
}

/** The personalised feed: ranked events in the next `days` days. */
export async function getRankedFeed(viewer: Viewer, { days, now }: { days: number; now: Date }): Promise<RankedEvent[]> {
  const events = await listCandidates({ to: new Date(now.getTime() + days * DAY), now });
  return rankEvents(events, viewer.profile, {
    followedOrganiserIds: viewer.followedOrganiserIds,
    state: viewer.state,
    now,
  });
}

// ─── Explore ────────────────────────────────────────────────────────────────

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export type SearchResult = { results: RankedEvent[]; truncated: boolean };

const SEARCH_LIMIT = 80;

/** Full-text + filtered search, sorted by relevance (personal score), date or deadline. */
export async function searchEvents(
  filters: SearchFilters,
  viewer: Viewer,
  categories: Pick<Category, "id" | "slug">[],
  now: Date,
): Promise<SearchResult> {
  const supabase = await createClient();
  const range = filters.date ? datePresetRange(filters.date, now) : null;
  const categoryIds = categories.filter((c) => filters.categories.includes(c.slug)).map((c) => c.id);

  const base = () => {
    let q = supabase
      .from("events")
      .select(DISCOVERY_SELECT)
      .eq("status", "published")
      .is("duplicate_of", null)
      .or(notEndedFilter(range?.from ?? now));
    if (range) q = q.lt("starts_at", range.to.toISOString());
    if (filters.categories.length) q = q.in("category_id", categoryIds.length ? categoryIds : ["00000000-0000-0000-0000-000000000000"]);
    // Quoted array literal: some synonyms have spaces ("net zero"), and postgrest-js doesn't quote.
    if (filters.interests.length) q = q.overlaps("tags", `{${filters.interests.flatMap(interestTags).map((t) => `"${t}"`).join(",")}}`);
    if (filters.formats.length) q = q.in("format", filters.formats);
    if (filters.price === "free") q = q.eq("price_min", 0);
    if (filters.price === "paid") q = q.gt("price_max", 0);
    if (filters.location) {
      const l = filters.location;
      q = q.or(`city.ilike.*${l}*,venue_name.ilike.*${l}*,address.ilike.*${l}*`);
    }
    return q.order("starts_at", { ascending: true }).limit(SEARCH_LIMIT);
  };

  let rows: DiscoveryEvent[];
  if (filters.q) {
    // Text matches, plus events from organisers whose name matches ("Northbridge", "Consulting Society").
    const { data: orgs } = await supabase
      .from("organisers")
      .select("id")
      .ilike("name", `%${escapeLike(filters.q)}%`)
      .limit(20);
    const orgIds = (orgs ?? []).map((o) => o.id as string);
    const [text, byOrg] = await Promise.all([
      base().textSearch("search", filters.q, { type: "websearch", config: "english" }),
      orgIds.length ? base().in("organiser_id", orgIds) : Promise.resolve({ data: [], error: null }),
    ]);
    if (text.error) throw text.error;
    const seen = new Map<string, DiscoveryEvent>();
    for (const e of [...(text.data ?? []), ...(byOrg.data ?? [])] as unknown as DiscoveryEvent[]) seen.set(e.id, e);
    rows = [...seen.values()];
  } else {
    const { data, error } = await base();
    if (error) throw error;
    rows = (data ?? []) as unknown as DiscoveryEvent[];
  }

  const withC = (await withCounts(nextOfEachSeries(rows))) as DiscoveryEvent[];
  const ranked = rankEvents(
    withC,
    viewer.profile,
    { followedOrganiserIds: viewer.followedOrganiserIds, state: viewer.state, now },
    { keepPersonal: true },
  );
  return { results: sortResults(ranked, filters.sort, now), truncated: rows.length >= SEARCH_LIMIT };
}

const time = (s: string | null) => (s ? new Date(s).getTime() : Number.POSITIVE_INFINITY);

export function sortResults(ranked: RankedEvent[], sort: SearchFilters["sort"], now: Date): RankedEvent[] {
  if (sort === "relevance") return ranked;
  const byStart = (a: RankedEvent, b: RankedEvent) => time(a.event.starts_at) - time(b.event.starts_at) || a.event.id.localeCompare(b.event.id);
  if (sort === "date") return [...ranked].sort(byStart);
  // Deadline: open deadlines soonest first, then everything else by date.
  const open = (r: RankedEvent) => {
    const d = time(r.event.registration_deadline);
    return d > now.getTime() ? d : Number.POSITIVE_INFINITY;
  };
  return [...ranked].sort((a, b) => open(a) - open(b) || byStart(a, b));
}

/** Soonest upcoming events (for the browse view). */
export async function listHappeningSoon(viewer: Viewer, now: Date, limit = 6): Promise<RankedEvent[]> {
  const events = await listCandidates({ to: new Date(now.getTime() + 14 * DAY), now, limit: 40 });
  // Explore shows everything, including events you've booked (marked on the card); only For You hides them.
  const ranked = rankEvents(events, viewer.profile, {
    followedOrganiserIds: viewer.followedOrganiserIds, state: viewer.state, now,
  }, { keepPersonal: true });
  return sortResults(ranked, "date", now).slice(0, limit);
}

/** Upcoming event counts per category id (for the browse view). */
export async function countUpcomingByCategory(now: Date): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("category_id")
    .eq("status", "published")
    .is("duplicate_of", null)
    .or(notEndedFilter(now))
    .limit(1000);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  }
  return counts;
}

// ─── Calendar ───────────────────────────────────────────────────────────────

export type CalendarEntry = {
  event: EventWithCounts;
  saved: boolean;
  registration?: RegistrationStatus;
};

/** Ids of events the user saved or holds an active registration for. */
function myCalendarIds(state: MyEventState) {
  const ids = new Set(state.saved);
  for (const [id, status] of state.registrations) if (ACTIVE_REGISTRATION.includes(status)) ids.add(id);
  for (const id of state.externalRegistered) ids.add(id);
  return [...ids];
}

/**
 * The user's saved + registered events overlapping [from, to), soonest first.
 * Cancelled events stay so people notice; RLS hides anything they can't see.
 */
export async function listMyCalendar(viewer: Viewer, { from, to }: { from: Date; to?: Date }): Promise<CalendarEntry[]> {
  const ids = myCalendarIds(viewer.state);
  if (!ids.length) return [];
  const supabase = await createClient();
  let q = supabase
    .from("events")
    .select(EVENT_CARD_SELECT)
    .in("id", ids)
    .in("status", ["published", "cancelled"])
    .or(notEndedFilter(from));
  if (to) q = q.lt("starts_at", to.toISOString());
  const { data, error } = await q.order("starts_at", { ascending: true }).limit(500);
  if (error) throw error;
  const events = await withCounts((data ?? []) as unknown as EventWithCounts[]);
  return events.map((event) => {
    const reg = viewer.state.registrations.get(event.id);
    return {
      event,
      saved: viewer.state.saved.has(event.id),
      registration: reg && ACTIVE_REGISTRATION.includes(reg) ? reg : undefined,
    };
  });
}
