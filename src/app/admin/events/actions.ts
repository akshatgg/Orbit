"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminEventSchema, fieldErrors, type FieldErrors } from "@/lib/admin/event-form";
import { adminContext, friendlyDbError, logAdminAction, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";
import { notifyEventChanged } from "@/lib/notifications";

const id = z.uuid();
const reasonSchema = z.string().trim().max(500, "Keep it under 500 characters");

type Patch = Record<string, unknown>;

async function updateEvent(eventId: string, patch: Patch, action: string, details: Patch = {}) {
  const { supabase } = await adminContext();
  const parsed = id.safeParse(eventId);
  if (!parsed.success) return { ok: false as const, error: "Invalid event" };
  const { data, error } = await supabase
    .from("events")
    .update(patch)
    .eq("id", parsed.data)
    .select("id, title")
    .maybeSingle();
  if (error) return { ok: false as const, error: friendlyDbError(error) };
  if (!data) return { ok: false as const, error: "Event not found" };
  await logAdminAction(supabase, action, "event", data.id, { title: data.title, ...details });
  revalidateEverywhere();
  return { ok: true as const, title: data.title as string };
}

export async function setFeatured(eventId: string, featured: boolean): Promise<ActionResult> {
  const r = await updateEvent(eventId, { is_featured: featured === true }, featured ? "event.feature" : "event.unfeature");
  return r.ok ? { ok: true, message: featured ? `Featured “${r.title}”` : `Unfeatured “${r.title}”` } : r;
}

export async function cancelEvent(eventId: string, reason?: string): Promise<ActionResult> {
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message };
  if (!parsedReason.data) return { ok: false, error: "Add a reason — guests will see it" };
  const r = await updateEvent(eventId, { status: "cancelled", cancel_reason: parsedReason.data }, "event.cancel", { reason: parsedReason.data });
  if (!r.ok) return r;
  try {
    await notifyEventChanged(eventId, "cancelled");
  } catch (e) {
    console.error("[admin] notifyEventChanged failed", e);
  }
  return { ok: true, message: `Cancelled “${r.title}” — guests will be notified` };
}

export async function removeEvent(eventId: string, reason?: string): Promise<ActionResult> {
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message };
  const r = await updateEvent(eventId, { status: "removed", is_featured: false }, "event.remove",
    parsedReason.data ? { reason: parsedReason.data } : {});
  return r.ok ? { ok: true, message: `Removed “${r.title}” from ORBIT` } : r;
}

/**
 * Bulk remove: hides every picked event from ORBIT in one request. Same soft-delete and audit
 * trail as `removeEvent`, so each row still shows up in the logs on its own.
 */
export async function removeEvents(eventIds: string[], reason?: string): Promise<ActionResult> {
  const parsed = z.array(id).min(1, "Pick at least one event").max(200).safeParse(eventIds);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const unique = [...new Set(parsed.data)];
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message };

  const { supabase } = await adminContext();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "removed", is_featured: false })
    .in("id", unique)
    .select("id, title");
  if (error) return { ok: false, error: friendlyDbError(error) };
  const removed = data ?? [];
  if (removed.length === 0) return { ok: false, error: "Those events no longer exist" };

  const details = { bulk: true, ...(parsedReason.data ? { reason: parsedReason.data } : {}) };
  await Promise.all(removed.map((e) => logAdminAction(supabase, "event.remove", "event", e.id, { title: e.title, ...details })));
  revalidateEverywhere();
  return {
    ok: true,
    message: removed.length === 1 ? `Removed “${removed[0].title}” from ORBIT` : `Removed ${removed.length} events from ORBIT`,
  };
}

/** Bulk re-categorise picked events. A null category clears it. */
export async function setEventsCategory(eventIds: string[], categoryId: string | null): Promise<ActionResult> {
  const parsed = z.array(id).min(1, "Pick at least one event").max(200).safeParse(eventIds);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  let value: string | null = null;
  if (categoryId !== null) {
    const parsedCategory = id.safeParse(categoryId);
    if (!parsedCategory.success) return { ok: false, error: "That category no longer exists" };
    value = parsedCategory.data;
  }

  const unique = [...new Set(parsed.data)];
  const { supabase } = await adminContext();
  const { data: category } = value
    ? await supabase.from("categories").select("name").eq("id", value).maybeSingle()
    : { data: null };
  const { data, error } = await supabase
    .from("events")
    .update({ category_id: value })
    .in("id", unique)
    .select("id, title");
  if (error) return { ok: false, error: friendlyDbError(error) };
  const updated = data ?? [];
  if (updated.length === 0) return { ok: false, error: "Those events no longer exist" };

  await Promise.all(
    updated.map((e) => logAdminAction(supabase, "event.category", "event", e.id, { title: e.title, bulk: true, category_id: value })),
  );
  revalidateEverywhere();
  return {
    ok: true,
    message: value === null
      ? `Cleared the category on ${updated.length} event${updated.length === 1 ? "" : "s"}`
      : `Moved ${updated.length} event${updated.length === 1 ? "" : "s"} to “${category?.name ?? "another category"}”`,
  };
}

export async function restoreEvent(eventId: string): Promise<ActionResult> {
  const r = await updateEvent(eventId, { status: "published", cancel_reason: null }, "event.restore");
  return r.ok ? { ok: true, message: `“${r.title}” is published again` } : r;
}

/**
 * Hard delete: removes the rows themselves and everything the schema cascades from an event —
 * registrations, tickets, questions, saved items, check-in history. Admin only, not reversible.
 */
async function hardDeleteEvents(ids: string[]): Promise<ActionResult> {
  const { supabase } = await adminContext();
  const { data, error: readError } = await supabase.from("events").select("id, title").in("id", ids);
  if (readError) return { ok: false, error: friendlyDbError(readError) };
  const doomed = data ?? [];
  if (doomed.length === 0) return { ok: false, error: "Those events no longer exist" };

  const eventIds = doomed.map((e) => e.id);
  const { count: registrations } = await supabase
    .from("registrations")
    .select("id", { count: "exact", head: true })
    .in("event_id", eventIds);

  const { error } = await supabase.from("events").delete().in("id", eventIds);
  if (error) return { ok: false, error: friendlyDbError(error) };

  await Promise.all(
    doomed.map((e) => logAdminAction(supabase, "event.delete", "event", e.id, { title: e.title, permanent: true })),
  );
  revalidateEverywhere();

  const what = doomed.length === 1 ? `“${doomed[0].title}”` : `${doomed.length} events`;
  const guests = registrations ? ` and ${registrations} registration${registrations === 1 ? "" : "s"}` : "";
  return { ok: true, message: `Deleted ${what}${guests} permanently` };
}

export async function deleteEvent(eventId: string): Promise<ActionResult> {
  const parsed = id.safeParse(eventId);
  if (!parsed.success) return { ok: false, error: "Invalid event" };
  return hardDeleteEvents([parsed.data]);
}

export async function deleteEvents(eventIds: string[]): Promise<ActionResult> {
  const parsed = z.array(id).min(1, "Pick at least one event").max(200).safeParse(eventIds);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return hardDeleteEvents([...new Set(parsed.data)]);
}

export async function markReviewed(eventId: string): Promise<ActionResult> {  const r = await updateEvent(eventId, { needs_review: false, last_verified_at: new Date().toISOString() }, "event.reviewed");
  return r.ok ? { ok: true, message: `Marked “${r.title}” as reviewed` } : r;
}

export type EventFormState = { error?: string; fieldErrors?: FieldErrors } | null;

/** Create (eventId null) or edit an admin-managed event. Bound with the id, used with useActionState. */
export async function saveEvent(eventId: string | null, _prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const { supabase } = await adminContext();
  const parsed = adminEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrors(parsed.error) };
  const values = parsed.data;

  if (eventId) {
    if (!id.safeParse(eventId).success) return { error: "Invalid event" };
    const { data: existing } = await supabase.from("events").select("registration_mode, tags").eq("id", eventId).maybeSingle();
    if (!existing) return { error: "Event not found" };
    if (existing.registration_mode === "tickets") {
      return { error: "This event sells ORBIT tickets — edit it from the organiser's event page" };
    }
    // Tags edited by hand are final: syncs stop adding interests, so a removed one stays removed.
    const before = [...((existing.tags as string[] | null) ?? [])].sort().join("\n");
    const tagsEdited = before !== [...values.tags].sort().join("\n");
    const { error } = await supabase
      .from("events")
      .update({ ...values, ...(tagsEdited ? { tags_locked: true } : {}), last_verified_at: new Date().toISOString() })
      .eq("id", eventId);
    if (error) return { error: friendlyDbError(error) };
    await logAdminAction(supabase, "event.update", "event", eventId, { title: values.title });
  } else {
    const { data, error } = await supabase
      .from("events")
      .insert({ ...values, status: "published", source: "manual", currency: "GBP" })
      .select("id")
      .single();
    if (error) return { error: friendlyDbError(error) };
    eventId = data.id as string;
    await logAdminAction(supabase, "event.create", "event", eventId, { title: values.title });
  }

  revalidateEverywhere();
  redirect(`/admin/events?when=all&q=${encodeURIComponent(values.title.slice(0, 60))}&saved=1`);
}
