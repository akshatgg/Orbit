"use server";

import { revalidatePath } from "next/cache";
import type { InteractionKind, UserEventKind } from "@/types/database";
import { api, ApiError } from "@/lib/api/client";
import { apiMessage } from "@/lib/api/errors";
import { authed, sessionToken } from "@/lib/api/session";

type Result = { ok: true; on: boolean } | { ok: false; error: string };

const NOT_FOUND = { "Event not found": "Event not found", "Organiser not found": "Organiser not found" };

/** Turns a personal mark (saved / dismissed / external_registered / attended) on or off. */
export async function setEventMark(eventId: string, kind: UserEventKind, on: boolean): Promise<Result> {
  try {
    const path = `/events/${encodeURIComponent(eventId)}/marks/${kind}`;
    if (on) await authed.put(path);
    else await authed.del(path);
  } catch (error) {
    return { ok: false, error: apiMessage(error, NOT_FOUND) };
  }
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
  try {
    const path = `/organisers/${encodeURIComponent(organiserId)}/follow`;
    if (follow) await authed.put(path);
    else await authed.del(path);
  } catch (error) {
    return { ok: false, error: apiMessage(error, NOT_FOUND) };
  }
  revalidatePath("/", "layout");
  return { ok: true, on: follow };
}

/** Records a view / apply click / share / calendar add for organiser stats. Never throws. */
export async function logInteraction(eventId: string, kind: InteractionKind) {
  try {
    const token = (await sessionToken()) ?? undefined;
    await api.post(`/events/${encodeURIComponent(eventId)}/interactions`, { body: { kind }, token });
  } catch (error) {
    // Analytics must never break the page.
    if (!(error instanceof ApiError)) console.error("[interactions]", error);
  }
}
