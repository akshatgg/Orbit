import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { OrbitEvent, Organiser, Category, RegistrationStatus, TicketType, Registration } from "@/types/database";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EventCounts } from "@/lib/events/queries";
import type { Question, TicketOption } from "./logic";

export const isId = (value: string) => z.guid().safeParse(value).success;

const EVENT_DETAIL_SELECT = `
  id, title, summary, description, cover_url, starts_at, ends_at, timezone, format, venue_name, address, city,
  latitude, longitude,
  tags, university, registration_mode, external_url, external_label, requires_approval, capacity,
  waitlist_enabled, registration_deadline, price_min, price_max, currency, status, cancel_reason,
  organiser_id, source, source_url, published_at,
  organiser:organisers ( id, slug, name, logo_url, is_verified, kind ),
  category:categories ( id, slug, name, group )
`;

export type EventDetail = Pick<
  OrbitEvent,
  | "id" | "title" | "summary" | "description" | "cover_url" | "starts_at" | "ends_at" | "timezone" | "format"
  | "venue_name" | "address" | "city" | "latitude" | "longitude" | "tags" | "university" | "registration_mode"
  | "external_url" | "external_label" | "requires_approval" | "capacity" | "waitlist_enabled" | "registration_deadline"
  | "price_min" | "price_max" | "currency" | "status" | "cancel_reason" | "organiser_id" | "source" | "source_url" | "published_at"
> & {
  organiser: Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified" | "kind"> | null;
  category: Pick<Category, "id" | "slug" | "name" | "group"> | null;
};

/** The event as the viewer is allowed to see it (RLS), or null. Deduplicated per request. */
export const getEvent = cache(async (id: string): Promise<EventDetail | null> => {
  if (!isId(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(EVENT_DETAIL_SELECT).eq("id", id).maybeSingle();
  return data as unknown as EventDetail | null;
});

export type MyRegistration = Pick<Registration, "id" | "status" | "ticket_type_id" | "qr_code" | "checked_in_at"> & {
  status: RegistrationStatus;
};

export type EventPageData = {
  event: EventDetail;
  userId: string | null;
  counts: EventCounts;
  /** Places left on the whole event (null = no cap). */
  spotsLeft: number | null;
  tickets: TicketOption[];
  questions: Question[];
  registration: MyRegistration | null;
  saved: boolean;
  externalRegistered: boolean;
  canManage: boolean;
  privateInfo: { online_url: string | null; guest_info: string | null } | null;
};

/** Everything the event page needs in one go. */
export async function getEventPageData(id: string): Promise<EventPageData | null> {
  const [event, user] = await Promise.all([getEvent(id), getCurrentUser()]);
  if (!event) return null;
  const supabase = await createClient();

  const [countsRes, availabilityRes, ticketsRes, questionsRes, regRes, marksRes, manageRes] = await Promise.all([
    supabase.rpc("event_counts", { event_ids: [event.id] }),
    supabase.rpc("ticket_availability", { p_event_id: event.id }),
    supabase.from("ticket_types").select("id, name, description, price, currency, quantity, sales_end_at, sort_order")
      .eq("event_id", event.id).order("sort_order").order("created_at"),
    supabase.from("event_questions").select("id, label, kind, options, required")
      .eq("event_id", event.id).order("sort_order").order("created_at"),
    user
      ? supabase.from("registrations").select("id, status, ticket_type_id, qr_code, checked_in_at")
        .eq("event_id", event.id).eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("user_events").select("kind").eq("event_id", event.id).eq("user_id", user.id)
      : Promise.resolve({ data: [] }),
    user ? supabase.rpc("can_manage_event", { ev: event.id }) : Promise.resolve({ data: false }),
  ]);

  const countRow = ((countsRes.data ?? []) as ({ event_id: string } & EventCounts)[])[0];
  const counts: EventCounts = countRow
    ? { going: countRow.going, waitlisted: countRow.waitlisted, pending: countRow.pending }
    : { going: 0, waitlisted: 0, pending: 0 };

  const availability = (availabilityRes.data ?? []) as { ticket_type_id: string; remaining: number | null; event_remaining: number | null }[];
  const remainingById = new Map(availability.map((a) => [a.ticket_type_id, a.remaining]));
  const spotsLeft = event.capacity === null ? null : (availability[0]?.event_remaining ?? event.capacity);

  const tickets: TicketOption[] = ((ticketsRes.data ?? []) as Pick<TicketType, "id" | "name" | "description" | "price" | "currency" | "quantity" | "sales_end_at">[])
    .map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      price: Number(t.price),
      currency: t.currency,
      remaining: remainingById.has(t.id) ? (remainingById.get(t.id) ?? null) : (t.quantity ?? spotsLeft),
      sales_end_at: t.sales_end_at,
    }));

  const registration = (regRes.data ?? null) as MyRegistration | null;
  const marks = new Set(((marksRes.data ?? []) as { kind: string }[]).map((m) => m.kind));

  let privateInfo: EventPageData["privateInfo"] = null;
  if (user && (registration?.status === "going" || manageRes.data === true)) {
    const { data } = await supabase.from("event_private").select("online_url, guest_info").eq("event_id", event.id).maybeSingle();
    if (data && (data.online_url || data.guest_info)) privateInfo = data;
  }

  return {
    event,
    userId: user?.id ?? null,
    counts,
    spotsLeft,
    tickets,
    questions: (questionsRes.data ?? []) as Question[],
    registration,
    saved: marks.has("saved"),
    externalRegistered: marks.has("external_registered"),
    canManage: manageRes.data === true,
    privateInfo,
  };
}

// ─── My Tickets ────────────────────────────────────────────────────────────

const TICKET_SELECT = `
  id, status, qr_code, checked_in_at, created_at, amount, currency, payment_status, ticket_type_id,
  ticket:ticket_types ( id, name, price, currency ),
  event:events (
    id, title, summary, cover_url, starts_at, ends_at, format, venue_name, address, city, status, cancel_reason,
    registration_mode,
    organiser:organisers ( id, slug, name, logo_url, is_verified )
  )
`;

export type TicketRow = Pick<
  Registration,
  "id" | "qr_code" | "checked_in_at" | "created_at" | "amount" | "currency" | "payment_status" | "ticket_type_id"
> & {
  status: RegistrationStatus;
  ticket: { id: string; name: string; price: number; currency: string } | null;
  event: Pick<
    OrbitEvent,
    | "id" | "title" | "summary" | "cover_url" | "starts_at" | "ends_at" | "format" | "venue_name" | "address" | "city"
    | "status" | "cancel_reason" | "registration_mode"
  > & { organiser: Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified"> | null };
};

/** The signed-in user's own registrations (organisers can read guests' too, so filter by user). */
export async function listMyTickets(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("registrations").select(TICKET_SELECT).eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as unknown as TicketRow[]).filter((r) => r.event);
}

export async function getMyTicket(userId: string, registrationId: string) {
  if (!isId(registrationId)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("registrations").select(TICKET_SELECT)
    .eq("id", registrationId).eq("user_id", userId).maybeSingle();
  const row = data as unknown as TicketRow | null;
  if (!row?.event) return null;

  let privateInfo: { online_url: string | null; guest_info: string | null } | null = null;
  if (row.status === "going") {
    const { data: p } = await supabase.from("event_private").select("online_url, guest_info").eq("event_id", row.event.id).maybeSingle();
    if (p && (p.online_url || p.guest_info)) privateInfo = p;
  }
  return { ticket: row, privateInfo };
}
