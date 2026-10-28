import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { EventStatus, RegistrationMode, RegistrationStatus } from "@/types/database";
import { isApiStatus } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { getCurrentUser } from "@/lib/auth";
import type { Guest, GuestQuestion } from "./types";

// Guest list, stats and the door, from the Orbit API's organiser endpoints
// (each one checks the caller can manage the event).

export const eventIdSchema = z.guid();

export type ManagedEvent = {
  id: string;
  title: string;
  summary: string | null;
  cover_url: string | null;
  starts_at: string;
  ends_at: string | null;
  status: EventStatus;
  venue_name: string | null;
  format: string;
  capacity: number | null;
  registration_mode: RegistrationMode;
  requires_approval: boolean;
  organiser: { id: string; name: string; slug: string } | null;
};

type EventDetail = {
  event: Omit<ManagedEvent, "organiser">;
  organiser: { id: string; name: string; slug: string } | null;
  questions: GuestQuestion[];
};

/** The editor payload for one event; null when it doesn't exist or isn't the caller's to manage. */
const getEventDetail = cache(async (id: string): Promise<EventDetail | null> => {
  if (!eventIdSchema.safeParse(id).success) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    return await authed.get<EventDetail>(`/organiser/events/${id}`);
  } catch (error) {
    if (isApiStatus(error, 401, 403, 404, 422)) return null;
    throw error;
  }
});

/**
 * The event, if the signed-in person can manage it (an organiser member or an admin);
 * otherwise null — callers should `notFound()`. Deduplicated per request.
 */
export const getManagedEvent = cache(async (id: string): Promise<ManagedEvent | null> => {
  const detail = await getEventDetail(id);
  if (!detail) return null;
  const e = detail.event;
  return {
    id: e.id, title: e.title, summary: e.summary, cover_url: e.cover_url, starts_at: e.starts_at, ends_at: e.ends_at,
    status: e.status, venue_name: e.venue_name, format: e.format, capacity: e.capacity,
    registration_mode: e.registration_mode, requires_approval: e.requires_approval, organiser: detail.organiser,
  };
});

/** Application questions for the event, in form order. */
export const getEventQuestions = cache(async (eventId: string): Promise<GuestQuestion[]> => {
  const detail = await getEventDetail(eventId);
  return (detail?.questions ?? []).map(({ id, label, kind }) => ({ id, label, kind }));
});

type GuestRow = {
  id: string;
  user_id: string;
  name: string | null;
  email: string | null;
  status: RegistrationStatus;
  ticket: string | null;
  answers: Record<string, unknown> | null;
  registered_at: string;
  checked_in_at: string | null;
};

type GuestPage = { items: GuestRow[]; total: number; page: number; page_size: number };

const GUEST_PAGE_SIZE = 100;

/** Everyone who registered (any status), newest first, with name / email from their profile. */
export const listGuests = cache(async (eventId: string): Promise<Guest[]> => {
  const rows: GuestRow[] = [];
  for (let page = 1; ; page += 1) {
    const result = await authed.get<GuestPage>(`/organiser/events/${eventId}/guests`, {
      query: { page, page_size: GUEST_PAGE_SIZE },
    });
    rows.push(...result.items);
    if (result.items.length < GUEST_PAGE_SIZE || rows.length >= result.total) break;
  }
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    email: r.email,
    status: r.status,
    ticket: r.ticket,
    answers: r.answers ?? {},
    registeredAt: r.registered_at,
    checkedInAt: r.checked_in_at,
  }));
});

/** Page views and Apply-now clicks logged for the event. */
export async function getInteractionCounts(eventId: string) {
  const stats = await authed.get<{ views: number; apply_clicks: number }>(`/organiser/events/${eventId}/stats`);
  return { views: stats.views ?? 0, applyClicks: stats.apply_clicks ?? 0 };
}

/** "42 / 60 checked in" for the door screen. */
export async function getCheckInCount(eventId: string) {
  const count = await authed.get<{ going: number; checked_in: number }>(`/organiser/events/${eventId}/check-in/count`);
  return { going: count.going ?? 0, checkedIn: count.checked_in ?? 0 };
}
