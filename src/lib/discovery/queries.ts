import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { Category, Profile, RegistrationStatus } from "@/types/database";
import {
  EVENT_CARD_SELECT, getMyEventState, withCounts, type EventWithCounts, type MyEventState,
} from "@/lib/events/queries";
import { ACTIVE_REGISTRATION, rankEvents, type Scored } from "@/lib/ranking";
import { createClient } from "@/lib/supabase/server";
import { datePresetRange } from "./dates";
import type { SearchFilters } from "./filters";
import { interestTags } from "@/lib/taxonomy";
import { countEventsByCategory, nextOfEachSeries } from "@/lib/events/series";
import { cityVariants, groupPlaces, knownCityNames, type PlaceGroup } from "@/lib/places";

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
/** A value double-quoted for a PostgREST filter (city names can have spaces). */
const quoted = (s: string) => `"${s.replace(/["\\]/g, (m) => `\\${m}`)}"`;

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
    if (filters.city) {
      // Any spelling of the city (Bangalore / Bengaluru), in the picked country or one we inferred.
      q = q.or(cityVariants(filters.city).map((c) => `city.ilike.${quoted(c)}`).join(","));
      if (filters.country) q = q.or(`country.eq.${filters.country},country.is.null`);
    } else if (filters.country) {
      // Events stored with the country, plus city-only events in its known cities.
      const known = knownCityNames(filters.country).map((c) => quoted(c)).join(",");
      q = q.or(known ? `country.eq.${filters.country},and(country.is.null,city.in.(${known}))` : `country.eq.${filters.country}`);
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

/** Soonest upcoming events (the home feed's fallback when nothing ranks). */
export async function listHappeningSoon(viewer: Viewer, now: Date, limit = 6): Promise<RankedEvent[]> {
  const events = await listCandidates({ to: new Date(now.getTime() + 14 * DAY), now, limit: 40 });
  // Explore shows everything, including events you've booked (marked on the card); only For You hides them.
  const ranked = rankEvents(events, viewer.profile, {
    followedOrganiserIds: viewer.followedOrganiserIds, state: viewer.state, now,
  }, { keepPersonal: true });
  return sortResults(ranked, "date", now).slice(0, limit);
}

/** Rows one PostgREST request returns at most (`max_rows`); longer lists are read in ranges. */
const MAX_ROWS = 1000;
const MAX_RANGES = 20;

/** Light columns of every published, not-ended event, soonest first, however many there are. */
async function upcomingRows<T>(columns: string, now: Date, { inPerson = false } = {}): Promise<T[]> {
  const supabase = await createClient();
  const rows: T[] = [];
  for (let range = 0; range < MAX_RANGES; range++) {
    let q = supabase
      .from("events")
      .select(columns)
      .eq("status", "published")
      .is("duplicate_of", null)
      .or(notEndedFilter(now));
    if (inPerson) q = q.neq("format", "online");
    const { data, error } = await q
      .order("starts_at", { ascending: true })
      .order("id", { ascending: true })
      .range(range * MAX_ROWS, (range + 1) * MAX_ROWS - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as unknown as T[]));
    if ((data ?? []).length < MAX_ROWS) break;
  }
  return rows;
}

export const EXPLORE_PAGE_SIZE = 24;

export type UpcomingPage = { results: RankedEvent[]; total: number; page: number; pageCount: number };

/** Every upcoming event, soonest first, one page at a time (a series counts once, at its next date). */
export async function listUpcomingPage(viewer: Viewer, now: Date, page: number): Promise<UpcomingPage> {
  const rows = nextOfEachSeries(await upcomingRows<{ id: string; series_key: string | null; starts_at: string }>("id, series_key, starts_at", now));
  const pageCount = Math.max(1, Math.ceil(rows.length / EXPLORE_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const ids = rows.slice((current - 1) * EXPLORE_PAGE_SIZE, current * EXPLORE_PAGE_SIZE).map((r) => r.id);
  if (!ids.length) return { results: [], total: rows.length, page: current, pageCount };
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select(DISCOVERY_SELECT).in("id", ids);
  if (error) throw error;
  const events = (await withCounts((data ?? []) as unknown as DiscoveryEvent[])) as DiscoveryEvent[];
  const ranked = rankEvents(events, viewer.profile, {
    followedOrganiserIds: viewer.followedOrganiserIds, state: viewer.state, now,
  }, { keepPersonal: true });
  return { results: sortResults(ranked, "date", now), total: rows.length, page: current, pageCount };
}

/** Upcoming event counts per category id (for the browse view). */
export async function countUpcomingByCategory(now: Date): Promise<Map<string, number>> {
  const rows = await upcomingRows<{ id: string; category_id: string | null; series_key: string | null }>("id, category_id, series_key", now)
    .catch(() => []);
  return countEventsByCategory(rows);
}

/** Places upcoming in-person events are in, as country → city lists (Location filter, header search). */
export const listUpcomingPlaces = cache(async (): Promise<PlaceGroup[]> => {
  await connection(); // per request: the time below must not be baked into a prerender
  // Every page's nav reads this: a failed read leaves the place lists empty rather than the page broken.
  const rows = await upcomingRows<{ id: string; city: string | null; country: string | null; series_key: string | null }>(
    "id, city, country, series_key", new Date(), { inPerson: true },
  ).catch(() => []);
  return groupPlaces(rows);
});

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
