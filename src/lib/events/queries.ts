import "server-only";
import type { Category, OrbitEvent, Organiser, RegistrationStatus } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

/** Columns every event list needs. Use with `.select(EVENT_CARD_SELECT)`. */
export const EVENT_CARD_SELECT = `
  id, title, summary, cover_url, starts_at, ends_at, timezone, format, venue_name, address, city, country, tags,
  university, registration_mode, external_url, external_label, requires_approval, capacity,
  registration_deadline, price_min, price_max, currency, status, is_featured, organiser_id,
  category_id, source, source_url, published_at, created_at, series_key, series_label,
  organiser:organisers ( id, slug, name, logo_url, is_verified, kind ),
  category:categories ( id, slug, name, group )
`;

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

const EMPTY_COUNTS: EventCounts = { going: 0, waitlisted: 0, pending: 0 };

/** Adds going / waitlisted / pending counts to a list of events. */
export async function withCounts(events: EventCardData[]): Promise<EventWithCounts[]> {
  if (events.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("event_counts", { event_ids: events.map((e) => e.id) });
  const rows = (data ?? []) as ({ event_id: string } & EventCounts)[];
  const byId = new Map(rows.map((c) => [c.event_id, c]));
  return events.map((e) => {
    const c = byId.get(e.id);
    return { ...e, counts: c ? { going: c.going, waitlisted: c.waitlisted, pending: c.pending } : EMPTY_COUNTS };
  });
}

/** Published events that haven't ended yet, soonest first. */
export async function listUpcomingEvents({ limit = 100 }: { limit?: number } = {}) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_CARD_SELECT)
    .eq("status", "published")
    .is("duplicate_of", null)
    .or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})`)
    .order("starts_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as EventCardData[];
}

export async function getEventCard(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_CARD_SELECT).eq("id", id).maybeSingle();
  return data as unknown as EventCardData | null;
}

export type MyEventState = {
  saved: Set<string>;
  dismissed: Set<string>;
  externalRegistered: Set<string>;
  attended: Set<string>;
  registrations: Map<string, RegistrationStatus>;
};

/** What the signed-in user has done with each event (saved, dismissed, ticket status…). */
export async function getMyEventState(userId: string | null | undefined, eventIds?: string[]): Promise<MyEventState> {
  const state: MyEventState = {
    saved: new Set(), dismissed: new Set(), externalRegistered: new Set(), attended: new Set(),
    registrations: new Map(),
  };
  if (!userId) return state;
  const supabase = await createClient();

  let ue = supabase.from("user_events").select("event_id, kind").eq("user_id", userId);
  let regs = supabase.from("registrations").select("event_id, status").eq("user_id", userId);
  if (eventIds) {
    if (eventIds.length === 0) return state;
    ue = ue.in("event_id", eventIds);
    regs = regs.in("event_id", eventIds);
  }
  const [{ data: marks }, { data: registrations }] = await Promise.all([ue, regs]);

  for (const m of marks ?? []) {
    if (m.kind === "saved") state.saved.add(m.event_id);
    else if (m.kind === "dismissed") state.dismissed.add(m.event_id);
    else if (m.kind === "external_registered") state.externalRegistered.add(m.event_id);
    else if (m.kind === "attended") state.attended.add(m.event_id);
  }
  for (const r of registrations ?? []) state.registrations.set(r.event_id, r.status as RegistrationStatus);
  return state;
}

export async function listCategories() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return data ?? [];
}
