import "server-only";
import type { Organiser } from "@/types/database";
import { EVENT_CARD_SELECT, withCounts, type EventCardData } from "@/lib/events/queries";
import { createClient } from "@/lib/supabase/server";

/** Every event of an organiser the signed-in member can see (drafts included), with counts. */
export async function listOrganiserEvents(organiserId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_CARD_SELECT)
    .eq("organiser_id", organiserId)
    .order("starts_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return withCounts((data ?? []) as unknown as EventCardData[]);
}

export async function getFollowerCount(organiserId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("organiser_follower_count", { org: organiserId });
  return typeof data === "number" ? data : 0;
}

export async function isFollowing(userId: string | null | undefined, organiserId: string) {
  if (!userId) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("organiser_id")
    .match({ user_id: userId, organiser_id: organiserId })
    .maybeSingle();
  return Boolean(data);
}

export async function getOrganiserBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organisers").select("*").eq("slug", slug).maybeSingle();
  return data as Organiser | null;
}

/** Public events (published / cancelled / expired) for the organiser page. */
export async function listPublicOrganiserEvents(organiserId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_CARD_SELECT)
    .eq("organiser_id", organiserId)
    .in("status", ["published", "cancelled", "expired"])
    .is("duplicate_of", null)
    .order("starts_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return withCounts((data ?? []) as unknown as EventCardData[]);
}

export type TeamMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: "owner" | "editor";
  created_at: string;
};

export async function listTeam(organiserId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organiser_members_list", { org: organiserId });
  if (error) throw error;
  return (data ?? []) as TeamMember[];
}

export type TeamInvite = {
  id: string;
  code: string;
  role: string;
  expires_at: string;
  max_uses: number;
  uses: number;
  revoked: boolean;
  created_at: string;
};

/** Invite links of an organisation (owners and admins only, enforced by RLS), newest first. */
export async function listInvites(organiserId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organiser_invites")
    .select("id, code, role, expires_at, max_uses, uses, revoked, created_at")
    .eq("organiser_id", organiserId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as TeamInvite[];
}

/** Everything the editor needs for one event. Null when it doesn't exist or isn't visible. */
export async function getEventForEdit(eventId: string) {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "id, organiser_id, status, cancel_reason, title, summary, description, category_id, tags, cover_url, starts_at, ends_at, format, venue_name, address, city, registration_mode, requires_approval, external_url, external_label, capacity, waitlist_enabled, registration_deadline, price_min, series_key",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const [priv, tickets, questions, counts, series] = await Promise.all([
    supabase.from("event_private").select("online_url, guest_info").eq("event_id", eventId).maybeSingle(),
    supabase
      .from("ticket_types")
      .select("id, name, price, quantity, sales_end_at")
      .eq("event_id", eventId)
      .order("sort_order")
      .order("created_at"),
    supabase
      .from("event_questions")
      .select("id, label, kind, options, required")
      .eq("event_id", eventId)
      .order("sort_order")
      .order("created_at"),
    supabase.rpc("event_counts", { event_ids: [eventId] }),
    event.series_key
      ? supabase.from("events").select("id", { count: "exact", head: true }).eq("series_key", event.series_key).neq("status", "removed")
      : Promise.resolve({ count: 1 }),
  ]);

  const c = ((counts.data ?? []) as { going: number; waitlisted: number; pending: number }[])[0];
  return {
    event,
    private: priv.data as { online_url: string | null; guest_info: string | null } | null,
    tickets: (tickets.data ?? []) as { id: string; name: string; price: number; quantity: number | null; sales_end_at: string | null }[],
    questions: (questions.data ?? []) as { id: string; label: string; kind: string; options: string[]; required: boolean }[],
    registrations: c ? c.going + c.waitlisted + c.pending : 0,
    /** How many dates the event's series has (1 for a one-off). */
    seriesDates: series.count ?? 1,
  };
}
