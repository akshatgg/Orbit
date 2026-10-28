"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authed } from "@/lib/api/session";
import { adminEventSchema, fieldErrors, type FieldErrors } from "@/lib/admin/event-form";
import { adminContext, adminError, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";

const id = z.uuid();
const reasonSchema = z.string().trim().max(500, "Keep it under 500 characters");

type EventRef = { id: string; title: string; registration_mode: string; tags: string[] };

/** Every admin action on one event: re-check the caller, read the title for the message, then act. */
async function onEvent(eventId: string, act: (id: string) => Promise<unknown>) {
  await adminContext();
  const parsed = id.safeParse(eventId);
  if (!parsed.success) return { ok: false as const, error: "Invalid event" };
  try {
    const event = await authed.get<EventRef>(`/admin/events/${parsed.data}`);
    await act(parsed.data);
    revalidateEverywhere();
    return { ok: true as const, title: event.title };
  } catch (error) {
    return { ok: false as const, error: adminError(error) };
  }
}

export async function setFeatured(eventId: string, featured: boolean): Promise<ActionResult> {
  const r = await onEvent(eventId, (e) => authed.post(`/admin/events/${e}/feature`, { body: { on: featured === true } }));
  return r.ok ? { ok: true, message: featured ? `Featured “${r.title}”` : `Unfeatured “${r.title}”` } : r;
}

/** Cancels with a public reason; the API notifies the guests. */
export async function cancelEvent(eventId: string, reason?: string): Promise<ActionResult> {
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message };
  if (!parsedReason.data) return { ok: false, error: "Add a reason — guests will see it" };
  const r = await onEvent(eventId, (e) => authed.post(`/admin/events/${e}/cancel`, { body: { reason: parsedReason.data } }));
  return r.ok ? { ok: true, message: `Cancelled “${r.title}” — guests will be notified` } : r;
}

export async function removeEvent(eventId: string, reason?: string): Promise<ActionResult> {
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message };
  const r = await onEvent(eventId, (e) =>
    parsedReason.data
      ? authed.post(`/admin/events/${e}/remove`, { body: { reason: parsedReason.data } })
      : authed.post("/admin/events/bulk/remove", { body: { ids: [e] } }),
  );
  return r.ok ? { ok: true, message: `Removed “${r.title}” from ORBIT` } : r;
}

/**
 * Bulk remove: hides every picked event from ORBIT in one request (unfeatured too).
 * The API logs one audit row per event.
 */
export async function removeEvents(eventIds: string[], reason?: string): Promise<ActionResult> {
  const parsed = z.array(id).min(1, "Pick at least one event").max(200).safeParse(eventIds);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const unique = [...new Set(parsed.data)];
  const parsedReason = reasonSchema.safeParse(reason ?? "");
  if (!parsedReason.success) return { ok: false, error: parsedReason.error.issues[0].message };

  await adminContext();
  let updated: number;
  let only: string | null = null;
  try {
    if (unique.length === 1) only = (await authed.get<EventRef>(`/admin/events/${unique[0]}`)).title;
    ({ updated } = await authed.post<{ updated: number }>("/admin/events/bulk/remove", {
      body: { ids: unique, ...(parsedReason.data ? { reason: parsedReason.data } : {}) },
    }));
  } catch (error) {
    return { ok: false, error: adminError(error, { "Those events no longer exist": "Those events no longer exist" }) };
  }
  if (updated === 0) return { ok: false, error: "Those events no longer exist" };
  revalidateEverywhere();
  return {
    ok: true,
    message: updated === 1 && only ? `Removed “${only}” from ORBIT` : `Removed ${updated} events from ORBIT`,
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
  await adminContext();
  let updated: number;
  let categoryName: string | undefined;
  try {
    if (value) {
      const { items } = await authed.get<{ items: { id: string; name: string }[] }>("/admin/categories");
      categoryName = items.find((c) => c.id === value)?.name;
      if (!categoryName) return { ok: false, error: "That category no longer exists" };
    }
    ({ updated } = await authed.post<{ updated: number }>("/admin/events/bulk/category", {
      body: { ids: unique, category_id: value },
    }));
  } catch (error) {
    return { ok: false, error: adminError(error, { "Category not found": "That category no longer exists" }) };
  }
  if (updated === 0) return { ok: false, error: "Those events no longer exist" };
  revalidateEverywhere();
  return {
    ok: true,
    message: value === null
      ? `Cleared the category on ${updated} event${updated === 1 ? "" : "s"}`
      : `Moved ${updated} event${updated === 1 ? "" : "s"} to “${categoryName ?? "another category"}”`,
  };
}

export async function restoreEvent(eventId: string): Promise<ActionResult> {
  const r = await onEvent(eventId, (e) => authed.post(`/admin/events/${e}/restore`));
  return r.ok ? { ok: true, message: `“${r.title}” is published again` } : r;
}

type DeleteResult = { deleted: number | boolean; registrations?: number; images?: number };

/**
 * Hard delete: removes the rows themselves and everything the schema cascades from an event —
 * registrations, tickets, questions, saved items, check-in history. Admin only, not reversible.
 * The API also releases Cloudinary covers no other event uses.
 */
async function hardDeleteEvents(ids: string[]): Promise<ActionResult> {
  await adminContext();
  let result: DeleteResult;
  let title: string | null = null;
  try {
    if (ids.length === 1) {
      title = (await authed.get<EventRef>(`/admin/events/${ids[0]}`)).title;
      result = await authed.del<DeleteResult>(`/admin/events/${ids[0]}`);
    } else {
      result = await authed.post<DeleteResult>("/admin/events/bulk/delete", { body: { ids } });
    }
  } catch (error) {
    return { ok: false, error: adminError(error, { "Event not found": "Those events no longer exist" }) };
  }
  const count = typeof result.deleted === "number" ? result.deleted : result.deleted ? 1 : 0;
  if (count === 0) return { ok: false, error: "Those events no longer exist" };
  revalidateEverywhere();

  const registrations = result.registrations ?? 0;
  const images = result.images ?? 0;
  const what = count === 1 && title ? `“${title}”` : `${count} event${count === 1 ? "" : "s"}`;
  const guests = registrations ? ` and ${registrations} registration${registrations === 1 ? "" : "s"}` : "";
  const pictures = images ? ` · ${images} image${images === 1 ? "" : "s"} removed` : "";
  return { ok: true, message: `Deleted ${what}${guests} permanently${pictures}` };
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

export async function markReviewed(eventId: string): Promise<ActionResult> {
  const r = await onEvent(eventId, (e) => authed.post(`/admin/events/${e}/reviewed`));
  return r.ok ? { ok: true, message: `Marked “${r.title}” as reviewed` } : r;
}

export type EventFormState = { error?: string; fieldErrors?: FieldErrors } | null;

/** Create (eventId null) or edit an admin-managed event. Bound with the id, used with useActionState. */
export async function saveEvent(eventId: string | null, _prev: EventFormState, formData: FormData): Promise<EventFormState> {
  await adminContext();
  const parsed = adminEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrors(parsed.error) };
  const { tags, ...values } = parsed.data;

  try {
    if (eventId) {
      if (!id.safeParse(eventId).success) return { error: "Invalid event" };
      const existing = await authed.get<EventRef>(`/admin/events/${eventId}`);
      if (existing.registration_mode === "tickets") {
        return { error: "This event sells ORBIT tickets — edit it from the organiser's event page" };
      }
      // Tags edited by hand are final: the API locks them, so syncs stop adding interests.
      const tagsEdited = [...(existing.tags ?? [])].sort().join("\n") !== [...tags].sort().join("\n");
      await authed.patch(`/admin/events/${eventId}`, { body: { ...values, ...(tagsEdited ? { tags } : {}) } });
    } else {
      await authed.post("/admin/events", { body: { ...values, tags, currency: "GBP" } });
    }
  } catch (error) {
    return { error: adminError(error, { "Event not found": "Event not found" }) };
  }

  revalidateEverywhere();
  redirect(`/admin/events?when=all&q=${encodeURIComponent(values.title.slice(0, 60))}&saved=1`);
}
