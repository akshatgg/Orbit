"use server";

import { revalidatePath } from "next/cache";
import type { InteractionKind, UserEventKind } from "@/types/database";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; on: boolean } | { ok: false; error: string };

/** Turns a personal mark (saved / dismissed / external_registered / attended) on or off. */
export async function setEventMark(eventId: string, kind: UserEventKind, on: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };
  const supabase = await createClient();

  const { error } = on
    ? await supabase.from("user_events").upsert({ user_id: user.id, event_id: eventId, kind })
    : await supabase.from("user_events").delete().match({ user_id: user.id, event_id: eventId, kind });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, on };
}

export async function toggleSaved(eventId: string, saved: boolean) {
  return setEventMark(eventId, "saved", saved);
}

export async function dismissEvent(eventId: string, dismissed = true) {
  return setEventMark(eventId, "dismissed", dismissed);
}

/** Follow / unfollow an organiser. */
export async function setFollow(organiserId: string, follow: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first" };
  const supabase = await createClient();
  const { error } = follow
    ? await supabase.from("follows").upsert({ user_id: user.id, organiser_id: organiserId })
    : await supabase.from("follows").delete().match({ user_id: user.id, organiser_id: organiserId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, on: follow };
}

/** Records a view / apply click / share / calendar add for organiser stats. Never throws. */
export async function logInteraction(eventId: string, kind: InteractionKind) {
  try {
    const user = await getCurrentUser();
    const supabase = await createClient();
    await supabase.from("event_interactions").insert({ event_id: eventId, kind, user_id: user?.id ?? null });
  } catch {
    // Analytics must never break the page.
  }
}
