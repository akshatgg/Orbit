import "server-only";
import { cache } from "react";
import { z } from "zod";
import type { EventStatus, RegistrationMode, RegistrationStatus } from "@/types/database";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Guest, GuestQuestion } from "./types";

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

/**
 * The event, if the signed-in person can manage it (an organiser member or an admin);
 * otherwise null — callers should `notFound()`. Deduplicated per request.
 */
export const getManagedEvent = cache(async (id: string): Promise<ManagedEvent | null> => {
  if (!eventIdSchema.safeParse(id).success) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_manage_event", { ev: id });
  if (allowed !== true) return null;
  const { data } = await supabase
    .from("events")
    .select(`id, title, summary, cover_url, starts_at, ends_at, status, venue_name, format, capacity,
      registration_mode, requires_approval, organiser:organisers ( id, name, slug )`)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as ManagedEvent | null) ?? null;
});

/** Application questions for the event, in form order. */
export const getEventQuestions = cache(async (eventId: string): Promise<GuestQuestion[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_questions")
    .select("id, label, kind")
    .eq("event_id", eventId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []) as GuestQuestion[];
});

type RegistrationRow = {
  id: string;
  user_id: string;
  status: RegistrationStatus;
  answers: Record<string, unknown> | null;
  created_at: string;
  checked_in_at: string | null;
  ticket_type: { name: string } | null;
};

/** Everyone who registered (any status), newest first, with name / email from their profile. */
export const listGuests = cache(async (eventId: string): Promise<Guest[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select("id, user_id, status, answers, created_at, checked_in_at, ticket_type:ticket_types ( name )")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as RegistrationRow[];

  // registrations.user_id points at auth.users, so profiles are fetched separately
  // (RLS lets organisers read the profiles of their own guests).
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const profiles = new Map<string, { full_name: string | null; email: string | null }>();
  for (let i = 0; i < userIds.length; i += 200) {
    const { data: batch } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds.slice(i, i + 200));
    for (const p of batch ?? []) profiles.set(p.id, p);
  }

  return rows.map((r) => {
    const p = profiles.get(r.user_id);
    return {
      id: r.id,
      userId: r.user_id,
      name: p?.full_name ?? null,
      email: p?.email ?? null,
      status: r.status,
      ticket: r.ticket_type?.name ?? null,
      answers: r.answers ?? {},
      registeredAt: r.created_at,
      checkedInAt: r.checked_in_at,
    };
  });
});

/** Page views and Apply-now clicks logged for the event. */
export async function getInteractionCounts(eventId: string) {
  const supabase = await createClient();
  const count = (kind: string) =>
    supabase.from("event_interactions").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("kind", kind);
  const [views, clicks] = await Promise.all([count("view"), count("apply_click")]);
  return { views: views.count ?? 0, applyClicks: clicks.count ?? 0 };
}

/** "42 / 60 checked in" for the door screen. */
export async function getCheckInCount(eventId: string) {
  const supabase = await createClient();
  const going = () =>
    supabase.from("registrations").select("id", { count: "exact", head: true }).eq("event_id", eventId).eq("status", "going");
  const [all, checked] = await Promise.all([going(), going().not("checked_in_at", "is", null)]);
  return { going: all.count ?? 0, checkedIn: checked.count ?? 0 };
}
