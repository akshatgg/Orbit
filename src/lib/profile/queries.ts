import "server-only";
import { cache } from "react";
import type { Organiser, RegistrationStatus } from "@/types/database";
import { EVENT_CARD_SELECT, type EventCardData } from "@/lib/events/queries";
import { createClient } from "@/lib/supabase/server";
import { hasEnded } from "./events";

type MarkRow = { event_id: string; kind: string; event: EventCardData | null };

export type ProfileEvent = EventCardData & {
  saved: boolean;
  attended: boolean;
  registration?: RegistrationStatus;
};

/** Registrations that mean "I was on the list" for the Past events section. */
const ATTENDING: RegistrationStatus[] = ["going"];

/**
 * The signed-in user's saved / registered / attended events, split into upcoming saved events
 * (soonest first) and ended events (most recent first). Everything is read through RLS.
 * Deduplicated per request so the Saved and Past sections share one query.
 */
export const getMyEventLists = cache(async (userId: string) => {
  const now = new Date();
  const supabase = await createClient();
  const [{ data: marks }, { data: regs }] = await Promise.all([
    supabase
      .from("user_events")
      .select(`event_id, kind, event:events (${EVENT_CARD_SELECT})`)
      .eq("user_id", userId)
      .in("kind", ["saved", "attended", "external_registered"]),
    supabase
      .from("registrations")
      .select(`event_id, status, event:events (${EVENT_CARD_SELECT})`)
      .eq("user_id", userId)
      .in("status", ATTENDING),
  ]);

  const byId = new Map<string, ProfileEvent>();
  const upsert = (event: EventCardData | null) => {
    if (!event) return null;
    let row = byId.get(event.id);
    if (!row) {
      row = { ...event, saved: false, attended: false };
      byId.set(event.id, row);
    }
    return row;
  };

  for (const m of (marks ?? []) as unknown as MarkRow[]) {
    const row = upsert(m.event);
    if (!row) continue;
    if (m.kind === "saved") row.saved = true;
    if (m.kind === "attended") row.attended = true;
  }
  for (const r of (regs ?? []) as unknown as { status: RegistrationStatus; event: EventCardData | null }[]) {
    const row = upsert(r.event);
    if (!row) continue;
    row.registration = r.status;
  }

  // Saved, registered, externally registered and "I went" events all belong in the history once over.
  const all = [...byId.values()].filter((e) => e.status !== "removed");
  const time = (e: EventCardData) => new Date(e.starts_at).getTime();

  const saved = all.filter((e) => e.saved && !hasEnded(e, now)).sort((a, b) => time(a) - time(b));
  const past = all.filter((e) => hasEnded(e, now)).sort((a, b) => time(b) - time(a));

  return { saved, past };
});

export type FollowedOrganiser = Pick<Organiser, "id" | "slug" | "name" | "logo_url" | "is_verified" | "kind" | "bio">;

/** Organisers the user follows, newest follow first. Organisers hidden by RLS are skipped. */
export async function getFollowedOrganisers(userId: string): Promise<FollowedOrganiser[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("created_at, organiser:organisers ( id, slug, name, logo_url, is_verified, kind, bio )")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as { organiser: FollowedOrganiser | null }[])
    .map((r) => r.organiser)
    .filter((o): o is FollowedOrganiser => o !== null);
}

/** Category slug → name, for the interests summary. */
export async function getCategoryNames() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("slug, name");
  return new Map((data ?? []).map((c) => [c.slug as string, c.name as string]));
}
