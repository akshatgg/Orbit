import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { OrbitEvent, Organiser, Category, RegistrationStatus, Registration } from "@/types/database";
import { ApiError } from "@/lib/api/client";
import { apiAs } from "@/lib/api/session";
import { getCurrentUser } from "@/lib/auth";
import { getAsViewer, type EventCounts, type EventWithCounts } from "@/lib/events/queries";
import { hasEnded, type Question, type TicketOption } from "./logic";

export const isId = (value: string) => z.guid().safeParse(value).success;

export type EventDetail = Pick<
  OrbitEvent,
  | "id" | "title" | "summary" | "description" | "cover_url" | "starts_at" | "ends_at" | "timezone" | "format"
  | "venue_name" | "address" | "city" | "latitude" | "longitude" | "tags" | "university" | "registration_mode"
  | "external_url" | "external_label" | "requires_approval" | "capacity" | "waitlist_enabled" | "registration_deadline"
  | "price_min" | "price_max" | "currency" | "status" | "cancel_reason" | "organiser_id" | "source" | "source_url" | "published_at"
  | "series_key" | "series_label"
> & {
  organiser: Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified" | "kind"> | null;
  category: Pick<Category, "id" | "slug" | "name" | "group"> | null;
};

export type MyRegistration = Pick<Registration, "id" | "status" | "ticket_type_id" | "qr_code" | "checked_in_at"> & {
  status: RegistrationStatus;
};

export type SeriesDate = Pick<OrbitEvent, "id" | "starts_at" | "ends_at" | "timezone">;

/** `GET /events/{id}`: the event with everything this viewer may see. */
type ApiEventDetail = Omit<EventDetail, "latitude" | "longitude" | "cancel_reason"> &
  Partial<Pick<EventDetail, "latitude" | "longitude" | "cancel_reason">> & {
    counts: EventCounts;
    ticket_types: {
      id: string; name: string; description: string | null; price: number; currency: string;
      quantity: number | null; sales_end_at: string | null; remaining: number | null;
    }[];
    event_questions: Question[];
    spots_left: number | null;
    can_manage: boolean;
    my_registration: (MyRegistration & { event_id: string }) | null;
    saved: boolean;
    external_registered: boolean;
    event_private: { online_url: string | null; guest_info: string | null } | null;
    series: { id: string; starts_at: string; ends_at: string | null; status: string }[];
  };

/** The full event as the viewer is allowed to see it, or null. Deduplicated per request. */
const getEventDetail = cache(async (id: string): Promise<ApiEventDetail | null> => {
  if (!isId(id)) return null;
  try {
    return await getAsViewer<ApiEventDetail>(`/events/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
});

function toEventDetail(d: ApiEventDetail): EventDetail {
  return {
    id: d.id, title: d.title, summary: d.summary, description: d.description, cover_url: d.cover_url,
    starts_at: d.starts_at, ends_at: d.ends_at, timezone: d.timezone, format: d.format, venue_name: d.venue_name,
    address: d.address, city: d.city, latitude: d.latitude ?? null, longitude: d.longitude ?? null, tags: d.tags,
    university: d.university, registration_mode: d.registration_mode, external_url: d.external_url,
    external_label: d.external_label, requires_approval: d.requires_approval, capacity: d.capacity,
    waitlist_enabled: d.waitlist_enabled, registration_deadline: d.registration_deadline, price_min: d.price_min,
    price_max: d.price_max, currency: d.currency, status: d.status, cancel_reason: d.cancel_reason ?? null,
    organiser_id: d.organiser_id, source: d.source, source_url: d.source_url, published_at: d.published_at,
    series_key: d.series_key, series_label: d.series_label, organiser: d.organiser, category: d.category,
  };
}

/** The event as the viewer is allowed to see it, or null. Deduplicated per request. */
export const getEvent = cache(async (id: string): Promise<EventDetail | null> => {
  const detail = await getEventDetail(id);
  return detail ? toEventDetail(detail) : null;
});

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
  /** Dates of the event's recurring series still to come, plus this one (null for a one-off). */
  series: { label: string | null; dates: SeriesDate[] } | null;
  privateInfo: { online_url: string | null; guest_info: string | null } | null;
};

/** The series' dates still to come, always including the one being viewed (it may have ended). */
function seriesFor(event: EventDetail, rows: SeriesDate[]): EventPageData["series"] {
  const now = new Date();
  const dates = rows.filter((d) => d.id === event.id || !hasEnded(d, now));
  return dates.length > 1 || event.series_label ? { label: event.series_label, dates } : null;
}

/** Everything the event page needs in one go. */
export async function getEventPageData(id: string): Promise<EventPageData | null> {
  const [detail, user] = await Promise.all([getEventDetail(id), getCurrentUser()]);
  if (!detail) return null;
  const event = toEventDetail(detail);

  // An unlimited ticket type's `remaining` is exactly what's left on the event (the API's
  // spots_left counts only confirmed guests, so prefer it when there is one).
  const unlimited = detail.ticket_types.find((t) => t.quantity === null);
  const spotsLeft = event.capacity === null ? null : (unlimited?.remaining ?? detail.spots_left ?? event.capacity);

  const tickets: TicketOption[] = detail.ticket_types.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    price: Number(t.price),
    currency: t.currency,
    remaining: t.remaining,
    sales_end_at: t.sales_end_at,
  }));

  const r = detail.my_registration;
  const registration: MyRegistration | null = r
    ? { id: r.id, status: r.status, ticket_type_id: r.ticket_type_id, qr_code: r.qr_code, checked_in_at: r.checked_in_at }
    : null;

  const private_ = detail.event_private;
  const seriesRows: SeriesDate[] = [
    { id: event.id, starts_at: event.starts_at, ends_at: event.ends_at, timezone: event.timezone },
    ...detail.series
      .filter((d) => d.status === "published" && d.id !== event.id)
      .map((d) => ({ id: d.id, starts_at: d.starts_at, ends_at: d.ends_at, timezone: event.timezone })),
  ].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  return {
    event,
    userId: user?.id ?? null,
    counts: detail.counts,
    spotsLeft,
    tickets,
    questions: detail.event_questions,
    registration,
    saved: detail.saved,
    externalRegistered: detail.external_registered,
    canManage: detail.can_manage,
    privateInfo: private_ && (private_.online_url || private_.guest_info) ? private_ : null,
    series: event.series_key ? seriesFor(event, seriesRows) : null,
  };
}

/** The event's questions, for validating registration answers before they're sent. */
export async function getEventQuestions(id: string): Promise<Question[] | null> {
  const detail = await getEventDetail(id);
  return detail ? detail.event_questions : null;
}

// ─── My Tickets ────────────────────────────────────────────────────────────

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

/** A row of `GET /me/tickets` (and the ticket itself from `GET /me/tickets/{id}`). */
type ApiTicket = {
  id: string;
  status: RegistrationStatus;
  payment_status: string;
  amount: number | string;
  currency: string;
  qr_code: string;
  checked_in_at: string | null;
  created_at: string;
  ticket_type_id?: string | null;
  event_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  cover_url: string | null;
  ticket_type: string | null;
  online_url?: string | null;
  guest_info?: string | null;
};

type MyEventCard = EventWithCounts & { registration: RegistrationStatus | null };

/**
 * The ticket rows carry the event's basics only; its status, format, summary and organiser come
 * from the person's own event lists (which include cancelled and expired events).
 */
const myEventsById = cache(async (): Promise<Map<string, MyEventCard>> => {
  const [upcoming, past] = await Promise.all([
    apiAs<{ items: MyEventCard[] }>("/me/events", { query: { when: "upcoming" } }),
    apiAs<{ items: MyEventCard[] }>("/me/events", { query: { when: "past" } }),
  ]);
  return new Map([...(upcoming?.items ?? []), ...(past?.items ?? [])].map((e) => [e.id, e]));
});

function toTicketRow(t: ApiTicket, events: Map<string, MyEventCard>): TicketRow {
  const card = events.get(t.event_id);
  const amount = Number(t.amount);
  return {
    id: t.id,
    status: t.status,
    qr_code: t.qr_code,
    checked_in_at: t.checked_in_at,
    created_at: t.created_at,
    amount,
    currency: t.currency,
    payment_status: t.payment_status,
    ticket_type_id: t.ticket_type_id ?? null,
    ticket: t.ticket_type ? { id: t.ticket_type_id ?? "", name: t.ticket_type, price: amount, currency: t.currency } : null,
    event: {
      id: t.event_id,
      title: t.title,
      summary: card?.summary ?? null,
      cover_url: t.cover_url,
      starts_at: t.starts_at,
      ends_at: t.ends_at,
      format: card?.format ?? (t.venue_name || t.address || t.city ? "in_person" : "online"),
      venue_name: t.venue_name,
      address: t.address,
      city: t.city,
      status: card?.status ?? "published",
      cancel_reason: null,
      registration_mode: card?.registration_mode ?? "tickets",
      organiser: card?.organiser
        ? { id: card.organiser.id, slug: card.organiser.slug, name: card.organiser.name, logo_url: card.organiser.logo_url, is_verified: card.organiser.is_verified }
        : null,
    },
  };
}

/** The signed-in user's own registrations. */
export async function listMyTickets() {
  const [upcoming, past, events] = await Promise.all([
    apiAs<{ items: ApiTicket[] }>("/me/tickets", { query: { tab: "upcoming" } }),
    apiAs<{ items: ApiTicket[] }>("/me/tickets", { query: { tab: "past" } }),
    myEventsById(),
  ]);
  return [...(upcoming?.items ?? []), ...(past?.items ?? [])].map((t) => toTicketRow(t, events));
}

export async function getMyTicket(registrationId: string) {
  if (!isId(registrationId)) return null;
  let row: ApiTicket | null;
  try {
    row = await apiAs<ApiTicket>(`/me/tickets/${registrationId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
  if (!row) return null;
  const ticket = toTicketRow(row, await myEventsById());

  // The API only returns the guest details to confirmed guests.
  const privateInfo = row.status === "going" && (row.online_url || row.guest_info)
    ? { online_url: row.online_url ?? null, guest_info: row.guest_info ?? null }
    : null;
  return { ticket, privateInfo };
}
