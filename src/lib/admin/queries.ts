import "server-only";
import type { Organiser, Profile } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

export type PersonLite = Pick<Profile, "id" | "full_name" | "email" | "avatar_url">;

/** id → name/email for a set of user ids (admins can read every profile). */
export async function profilesByIds(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  const map = new Map<string, PersonLite>();
  if (unique.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", unique);
  for (const p of (data ?? []) as PersonLite[]) map.set(p.id, p);
  return map;
}

export function personName(p: PersonLite | undefined | null) {
  return p?.full_name || p?.email || "Unknown";
}

export type AdminOrganiser = Organiser & { event_count: number };

/** Every organiser (any status) with its event count. Small table — filtered in memory. */
export async function listOrganisersWithCounts(): Promise<AdminOrganiser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisers")
    .select("*, events(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as (Organiser & { events: { count: number }[] })[]).map(({ events, ...o }) => ({
    ...o,
    event_count: events?.[0]?.count ?? 0,
  }));
}

export type MemberRow = { organiser_id: string; user_id: string; role: "owner" | "editor"; created_at: string };

export async function membersFor(organiserIds: string[]) {
  const byOrg = new Map<string, MemberRow[]>();
  if (organiserIds.length === 0) return byOrg;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organiser_members")
    .select("organiser_id, user_id, role, created_at")
    .in("organiser_id", organiserIds)
    .order("created_at");
  for (const m of (data ?? []) as MemberRow[]) {
    byOrg.set(m.organiser_id, [...(byOrg.get(m.organiser_id) ?? []), m]);
  }
  return byOrg;
}
