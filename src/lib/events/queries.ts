import "server-only";
import type { Category, OrbitEvent, Organiser, RegistrationStatus } from "@/types/database";
import { api, ApiError, type RequestOptions } from "@/lib/api/client";
import { apiAs, sessionToken } from "@/lib/api/session";

/** The event card every list and feed of the Orbit API returns (`EventCard`). */
export type EventCardData = Pick<
  OrbitEvent,
  | "id" | "title" | "summary" | "cover_url" | "starts_at" | "ends_at" | "timezone" | "format"
  | "venue_name" | "address" | "city" | "country" | "tags" | "university" | "registration_mode" | "external_url"
  | "external_label" | "requires_approval" | "capacity" | "registration_deadline" | "price_min"
  | "price_max" | "currency" | "status" | "is_featured" | "organiser_id" | "category_id" | "source"
  | "source_url" | "published_at" | "created_at" | "series_key" | "series_label"
> & {
  organiser: Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified" | "kind"> | null;
  category: Pick<Category, "id" | "slug" | "name" | "group"> | null;
};

import type { EventCounts } from "./spots";

export { spotsLeft, type EventCounts } from "./spots";

export type EventWithCounts = EventCardData & { counts: EventCounts };

/** A card as the API sends it: counts included, plus the ranking fields on feeds. */
export type ApiEventCard = EventWithCounts & {
  waitlist_enabled?: boolean;
  score?: number | null;
  reason?: string | null;
};

export type ApiEventPage<T = ApiEventCard> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  truncated?: boolean;
};

const EMPTY_COUNTS: EventCounts = { going: 0, waitlisted: 0, pending: 0 };

/** Ids per request for the endpoints that take an id list (the API's limit). */
const MAX_IDS = 200;

function chunks<T>(items: T[], size = MAX_IDS): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * A GET as whoever is looking: with the session when there is one (so the API can add the
 * viewer's own state), anonymous otherwise or when the session has expired.
 */
export async function getAsViewer<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await sessionToken();
  if (token) {
    try {
      return await api.get<T>(path, { ...options, token });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) throw error;
    }
  }
  return api.get<T>(path, options);
}

/** Adds going / waitlisted / pending counts to a list of events. */
export async function withCounts<E extends EventCardData>(events: E[]): Promise<(E & { counts: EventCounts })[]> {
  if (events.length === 0) return [];
  const ids = [...new Set(events.map((e) => e.id))];
  const rows = (
    await Promise.all(
      chunks(ids).map((part) =>
        api.get<({ event_id: string } & EventCounts)[]>("/events/counts", { query: { ids: part.join(",") } }),
      ),
    )
  ).flat();
  const byId = new Map(rows.map((c) => [c.event_id, c]));
  return events.map((e) => {
    const c = byId.get(e.id);
    return { ...e, counts: c ? { going: c.going, waitlisted: c.waitlisted, pending: c.pending } : EMPTY_COUNTS };
  });
}

/** Published events that haven't ended yet, soonest first. */
export async function listUpcomingEvents({ limit = 100 }: { limit?: number } = {}) {
  const page = await api.get<ApiEventPage>("/events/upcoming", {
    query: { page_size: Math.min(limit, 100) },
  });
  return page.items;
}

export async function getEventCard(id: string) {
  try {
    return await api.get<EventCardData>(`/events/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) return null;
    throw error;
  }
}

export type MyEventState = {
  saved: Set<string>;
  dismissed: Set<string>;
  externalRegistered: Set<string>;
  attended: Set<string>;
  registrations: Map<string, RegistrationStatus>;
};

type ApiEventState = {
  saved: string[];
  dismissed: string[];
  external_registered: string[];
  attended: string[];
  registrations: Record<string, RegistrationStatus>;
};

/** What the signed-in user has done with each event (saved, dismissed, ticket status…). */
export async function getMyEventState(userId: string | null | undefined, eventIds?: string[]): Promise<MyEventState> {
  const state: MyEventState = {
    saved: new Set(), dismissed: new Set(), externalRegistered: new Set(), attended: new Set(),
    registrations: new Map(),
  };
  if (!userId) return state;
  if (eventIds && eventIds.length === 0) return state;

  const parts = eventIds
    ? await Promise.all(
      chunks([...new Set(eventIds)]).map((ids) =>
        apiAs<ApiEventState>("/me/event-state", { query: { event_ids: ids.join(",") } }),
      ),
    )
    : [await apiAs<ApiEventState>("/me/event-state")];

  for (const part of parts) {
    if (!part) continue;
    for (const id of part.saved) state.saved.add(id);
    for (const id of part.dismissed) state.dismissed.add(id);
    for (const id of part.external_registered) state.externalRegistered.add(id);
    for (const id of part.attended) state.attended.add(id);
    for (const [id, status] of Object.entries(part.registrations)) state.registrations.set(id, status);
  }
  return state;
}

export async function listCategories() {
  return api.get<Category[]>("/categories");
}
