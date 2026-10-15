"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { notifyEventChanged } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import {
  formToEventRow, formToPrivateRow, formToQuestionRows, formToTicketRows, logisticsChanged, type EventForm,
} from "./event-form";
import { validateEventForm, type EventIntent, type EventIssue } from "./schemas";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SaveEventInput = {
  organiserId: string;
  eventId?: string | null;
  intent: EventIntent;
  form: EventForm;
};

export type SaveEventResult =
  | { ok: true; id: string; status: string; notified: boolean; ticketIds: string[]; questionIds: string[] }
  | { ok: false; error: string; issues?: EventIssue[]; id?: string };

type Fail = { ok: false; error: string; issues?: EventIssue[]; id?: string };

const SIGNED_OUT = "Your session has ended. Sign in again to continue.";
const ACTIVE_REGISTRATION = ["going", "pending", "waitlisted", "awaiting_payment"];

function friendly(error: { message?: string; code?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === "42501" || /row-level security|permission denied/i.test(error.message ?? "")) {
    return "You don't have permission to do that. Only members of an approved organiser can manage its events.";
  }
  if (error.code === "23514") return "Some details don't look right. Check the dates, capacity and links.";
  return fallback;
}

/**
 * Creates or updates an event with its tickets, questions and private details.
 * New events are written as drafts first and only published once every part has saved,
 * so a half-saved event is never live.
 */
export async function saveEvent(input: SaveEventInput): Promise<SaveEventResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };

  const ids = z
    .object({ organiserId: z.uuid(), eventId: z.uuid().nullish(), intent: z.enum(["draft", "publish"]) })
    .safeParse(input);
  if (!ids.success) return { ok: false, error: "Something went wrong — reload the page and try again." };
  const { organiserId, eventId } = ids.data;
  let intent = ids.data.intent;

  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organisers")
    .select("id, slug, status, stripe_charges_enabled")
    .eq("id", organiserId)
    .maybeSingle();
  if (!org) return { ok: false, error: "Organiser not found." };
  if (org.status !== "approved") {
    return { ok: false, error: "Your organiser needs to be approved by the ORBIT team before you can create events." };
  }

  let existing: {
    id: string; organiser_id: string; status: string; starts_at: string; ends_at: string | null;
    venue_name: string | null; address: string | null; format: string; registration_mode: string;
  } | null = null;
  if (eventId) {
    const { data } = await supabase
      .from("events")
      .select("id, organiser_id, status, starts_at, ends_at, venue_name, address, format, registration_mode")
      .eq("id", eventId)
      .maybeSingle();
    if (!data || data.organiser_id !== organiserId) return { ok: false, error: "Event not found." };
    if (data.status === "cancelled" || data.status === "removed") {
      return { ok: false, error: "This event is cancelled, so it can't be edited." };
    }
    existing = data;
  }

  const wasPublished = existing?.status === "published";
  if (wasPublished) intent = "publish"; // live events save in place with publish rules

  const checked = validateEventForm(input.form, {
    intent,
    chargesEnabled: org.stripe_charges_enabled,
    originalStartsAt: existing?.starts_at ?? null,
  });
  if (!checked.ok) return { ok: false, error: checked.issues[0].message, issues: checked.issues };
  const form = checked.data;
  const row = formToEventRow(form);

  if (existing && existing.registration_mode === "tickets" && row.registration_mode !== "tickets") {
    const { data: regs } = await supabase
      .from("registrations")
      .select("id")
      .eq("event_id", existing.id)
      .in("status", ACTIVE_REGISTRATION)
      .limit(1);
    if (regs?.length) {
      return {
        ok: false,
        error: "People have already registered through ORBIT, so registration can't move off ORBIT tickets. Cancel the event instead if plans changed.",
        issues: [{ path: "registration", message: "Guests already have tickets", step: "registration" }],
      };
    }
  }

  // 1. The event itself.
  let id = existing?.id;
  if (!existing) {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...row, organiser_id: organiserId, status: "draft", source: "orbit" })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: friendly(error, "We couldn't create the event. Please try again.") };
    id = data.id as string;
  } else {
    const { error } = await supabase.from("events").update(row).eq("id", existing.id);
    if (error) return { ok: false, error: friendly(error, "We couldn't save the event. Please try again."), id };
  }
  const eventIdSaved = id!;

  // 2. Private details, tickets and questions.
  const { error: privError } = await supabase
    .from("event_private")
    .upsert({ event_id: eventIdSaved, ...formToPrivateRow(form) }, { onConflict: "event_id" });
  if (privError) return { ok: false, error: friendly(privError, "We couldn't save the online link."), id: eventIdSaved };

  const tickets = await syncChildren(supabase, "ticket_types", eventIdSaved, formToTicketRows(form), true);
  if (!tickets.ok) return { ...tickets, id: eventIdSaved };
  const questions = await syncChildren(supabase, "event_questions", eventIdSaved, formToQuestionRows(form), false);
  if (!questions.ok) return { ...questions, id: eventIdSaved };

  // 3. Go live.
  let status = existing?.status ?? "draft";
  if (intent === "publish" && !wasPublished) {
    const { error } = await supabase.from("events").update({ status: "published" }).eq("id", eventIdSaved);
    if (error) return { ok: false, error: friendly(error, "Saved as a draft, but we couldn't publish it."), id: eventIdSaved };
    status = "published";
  }

  // 4. Tell guests if the time or place moved.
  let notified = false;
  if (existing && wasPublished && logisticsChanged(existing, row)) {
    await notifyEventChanged(eventIdSaved, "updated");
    notified = true;
  }

  revalidatePath("/", "layout");
  return { ok: true, id: eventIdSaved, status, notified, ticketIds: tickets.ids, questionIds: questions.ids };
}

type ChildRow = { id?: string; sort_order: number } & Record<string, unknown>;

/** Makes the event's ticket types / questions match `rows`: update kept ones, insert new, delete removed. */
async function syncChildren(
  supabase: Supabase,
  table: "ticket_types" | "event_questions",
  eventId: string,
  rows: ChildRow[],
  protectRegistered: boolean,
): Promise<{ ok: true; ids: string[] } | Fail> {
  const what = table === "ticket_types" ? "tickets" : "questions";
  const { data: current, error: readError } = await supabase.from(table).select("id").eq("event_id", eventId);
  if (readError) return { ok: false, error: friendly(readError, `We couldn't load the ${what}.`) };

  const currentIds = new Set((current ?? []).map((r) => r.id as string));
  const keep = new Set(rows.filter((r) => r.id && currentIds.has(r.id)).map((r) => r.id!));
  const remove = [...currentIds].filter((cid) => !keep.has(cid));

  if (remove.length > 0) {
    if (protectRegistered) {
      const { data: used } = await supabase
        .from("registrations")
        .select("id")
        .eq("event_id", eventId)
        .in("ticket_type_id", remove)
        .in("status", ACTIVE_REGISTRATION)
        .limit(1);
      if (used?.length) {
        return {
          ok: false,
          error: "A ticket type you removed already has guests. Keep it (you can lower its quantity) or cancel those registrations first.",
          issues: [{ path: "tickets", message: "Removed ticket has guests", step: "tickets" }],
        };
      }
    }
    const { error } = await supabase.from(table).delete().in("id", remove);
    if (error) return { ok: false, error: friendly(error, `We couldn't update the ${what}.`) };
  }

  const ids: string[] = [];
  for (const [i, { id, ...values }] of rows.entries()) {
    if (id && keep.has(id)) {
      const { error } = await supabase.from(table).update(values).eq("id", id);
      if (error) return { ok: false, error: friendly(error, `We couldn't save the ${what}.`) };
      ids[i] = id;
    } else {
      const { data, error } = await supabase
        .from(table)
        .insert({ ...values, event_id: eventId })
        .select("id")
        .single();
      if (error || !data) return { ok: false, error: friendly(error, `We couldn't save the ${what}.`) };
      ids[i] = data.id as string;
    }
  }
  return { ok: true, ids };
}

/** Cancels a published event (guests are told) — it stays visible, marked cancelled. */
export async function cancelEvent(eventId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const parsed = z
    .object({ id: z.uuid(), reason: z.string().trim().min(3, "Tell guests why (a few words is fine)").max(500, "Keep the reason under 500 characters") })
    .safeParse({ id: eventId, reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "cancelled", cancel_reason: parsed.data.reason })
    .eq("id", parsed.data.id)
    .eq("status", "published")
    .select("id");
  if (error) return { ok: false, error: friendly(error, "We couldn't cancel the event. Please try again.") };
  if (!data?.length) return { ok: false, error: "Only published events you manage can be cancelled." };

  await notifyEventChanged(parsed.data.id, "cancelled");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deletes a draft (published events are cancelled instead, so guests aren't left hanging). */
export async function deleteDraftEvent(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const id = z.uuid().safeParse(eventId);
  if (!id.success) return { ok: false, error: "Event not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").delete().eq("id", id.data).eq("status", "draft").select("id");
  if (error) return { ok: false, error: friendly(error, "We couldn't delete the draft. Please try again.") };
  if (!data?.length) return { ok: false, error: "Only drafts can be deleted. Cancel a published event instead." };

  revalidatePath("/organiser", "layout");
  return { ok: true };
}
