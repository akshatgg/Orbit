import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import type { Profile, RegistrationStatus } from "@/types/database";
import { apiAs } from "@/lib/api/session";
import {
  getAsViewer, getMyEventState, type ApiEventCard, type ApiEventPage, type EventWithCounts, type MyEventState,
} from "@/lib/events/queries";
import { ACTIVE_REGISTRATION, type Scored } from "@/lib/ranking";
import type { SearchFilters } from "./filters";
import type { PlaceGroup } from "@/lib/places";

// Discovery reads from the Orbit API. Ranking ("Recommended because …"), series collapse and
// search parity all happen there; each card arrives with its `score` and `reason`.

export type DiscoveryEvent = EventWithCounts & { waitlist_enabled: boolean };
export type RankedEvent = Scored<DiscoveryEvent>;

/** The API's ranked card → the shape the feed components render. */
function ranked(card: ApiEventCard): RankedEvent {
  const { score, reason, ...event } = card;
  return {
    event: { ...event, waitlist_enabled: event.waitlist_enabled ?? true },
    score: score ?? 0,
    signals: [],
    reason: reason ?? null,
    excluded: null,
  };
}

export type Viewer = {
  profile: Profile;
  followedOrganiserIds: Set<string>;
  state: MyEventState;
};

/** Who's looking: follows + saved / dismissed / ticket state. Deduplicated per request. */
export const getViewer = cache(async (profile: Profile): Promise<Viewer> => {
  const [following, state] = await Promise.all([
    apiAs<{ items: { id: string }[] }>("/me/following"),
    getMyEventState(profile.id),
  ]);
  return {
    profile,
    followedOrganiserIds: new Set((following?.items ?? []).map((o) => o.id)),
    state,
  };
});

/**
 * The personalised feed: events in the next `days` days, best for this person first, one card per
 * series. Dismissed and already-booked events are left out by the API.
 */
export async function getRankedFeed({ days }: { days: number }): Promise<RankedEvent[]> {
  const page = await apiAs<ApiEventPage>("/feed/for-you", { query: { days } });
  return (page?.items ?? []).map(ranked);
}

// ─── Explore ────────────────────────────────────────────────────────────────

export type SearchResult = { results: RankedEvent[]; truncated: boolean };

/** Most results one request returns (the API's page size limit). */
const SEARCH_PAGE = 100;
/** Ranked sorts rank at most this many candidates; read a second page when there are more. */
const SEARCH_MAX = 160;

/** Full-text + filtered search, sorted by relevance (personal score), date or deadline. */
export async function searchEvents(filters: SearchFilters): Promise<SearchResult> {
  const query = {
    q: filters.q || undefined,
    category: filters.categories,
    interest: filters.interests,
    format: filters.formats,
    date: filters.date ?? undefined,
    country: filters.country ?? undefined,
    city: filters.city || undefined,
    sort: filters.sort,
    page_size: SEARCH_PAGE,
  };
  const first = await getAsViewer<ApiEventPage>("/events", { query });
  let items = first.items;
  const ranks = filters.sort === "relevance" || filters.sort === "deadline";
  if (ranks && first.total > SEARCH_PAGE) {
    const second = await getAsViewer<ApiEventPage>("/events", { query: { ...query, page: 2 } });
    items = [...items, ...second.items].slice(0, SEARCH_MAX);
  }
  const truncated = ranks ? Boolean(first.truncated) : first.total > items.length;
  return { results: items.map(ranked), truncated };
}

/** Soonest upcoming events (the home feed's fallback when nothing ranks). */
export async function listHappeningSoon(limit = 6): Promise<RankedEvent[]> {
  const page = await getAsViewer<ApiEventPage>("/events/happening-soon", { query: { limit } });
  return page.items.map(ranked);
}

export const EXPLORE_PAGE_SIZE = 24;

export type UpcomingPage = { results: RankedEvent[]; total: number; page: number; pageCount: number };

/** Every upcoming event, soonest first, one page at a time (a series counts once, at its next date). */
export async function listUpcomingPage(page: number): Promise<UpcomingPage> {
  const fetchPage = (n: number) =>
    getAsViewer<ApiEventPage>("/events/upcoming", { query: { page: n, page_size: EXPLORE_PAGE_SIZE } });
  let current = Math.max(1, page);
  let result = await fetchPage(current);
  const pageCount = Math.max(1, Math.ceil(result.total / EXPLORE_PAGE_SIZE));
  if (current > pageCount) {
    current = pageCount;
    result = await fetchPage(current);
  }
  return { results: result.items.map(ranked), total: result.total, page: current, pageCount };
}

export type DiscoveryCounts = {
  /** Upcoming events overall; null if counting failed. */
  total: number | null;
  /** Upcoming events per category slug. */
  byCategory: Map<string, number>;
  /** Upcoming events per interest (a missing interest has none). */
  byInterest: Map<string, number>;
};

type ApiCounts = {
  total: number;
  category: { slug: string; events: number }[];
  interest: { slug: string; events: number }[];
};

/** Upcoming events overall, per category and per interest — counted by the API. */
export async function getDiscoveryCounts(): Promise<DiscoveryCounts> {
  const counts: DiscoveryCounts = { total: null, byCategory: new Map(), byInterest: new Map() };
  try {
    const data = await getAsViewer<ApiCounts>("/discovery/counts");
    counts.total = data.total;
    for (const row of data.category) counts.byCategory.set(row.slug, Number(row.events));
    for (const row of data.interest) counts.byInterest.set(row.slug, Number(row.events));
  } catch {
    // Counts are a hint: without them the tabs and filters still work, just unnumbered.
  }
  return counts;
}

type ApiPlaces = { country: string | null; name: string; flag: string; events: number; cities: { city: string; events: number }[] }[];

/** The API's country → city counts (spellings merged, unknown countries last as "Other places"). */
function placeGroups(rows: ApiPlaces): PlaceGroup[] {
  return rows.map((g) => ({
    country: g.country,
    name: g.name,
    flag: g.flag,
    count: Number(g.events),
    cities: g.cities.map((c) => ({ city: c.city, count: Number(c.events) })),
  }));
}

/** Places upcoming in-person and hybrid events are in, as country → city lists (Location filter, header search). */
export const listUpcomingPlaces = cache(async (): Promise<PlaceGroup[]> => {
  await connection(); // per request: never baked into a prerender
  // Every page's nav reads this: a failed read leaves the place lists empty rather than the page broken.
  try {
    return placeGroups(await getAsViewer<ApiPlaces>("/discovery/places"));
  } catch {
    return [];
  }
});

// ─── Calendar ───────────────────────────────────────────────────────────────

export type CalendarEntry = {
  event: EventWithCounts;
  saved: boolean;
  registration?: RegistrationStatus;
};

type ApiMyEventCard = EventWithCounts & {
  saved: boolean;
  attended: boolean;
  external_registered: boolean;
  registration: RegistrationStatus | null;
};

/** How far ahead an open-ended calendar range reaches. */
const OPEN_ENDED_DAYS = 3650;

/**
 * The user's saved + registered events overlapping [from, to), soonest first.
 * Cancelled events stay so people notice.
 */
export async function listMyCalendar({ from, to }: { from: Date; to?: Date }): Promise<CalendarEntry[]> {
  const until = to ?? new Date(from.getTime() + OPEN_ENDED_DAYS * 864e5);
  const page = await apiAs<{ items: ApiMyEventCard[] }>("/me/calendar", {
    query: { from: from.toISOString(), to: until.toISOString() },
  });
  return (page?.items ?? []).map(({ saved, registration, ...event }) => ({
    event,
    saved,
    registration: registration && ACTIVE_REGISTRATION.includes(registration) ? registration : undefined,
  }));
}
