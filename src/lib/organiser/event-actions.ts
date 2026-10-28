"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiErrorCode, apiMessage, isApiStatus, isConflict, isSignedOut } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { getCurrentUser, getMyOrganisers } from "@/lib/auth";
import {
  formToEventRow, formToPrivateRow, formToQuestionRows, formToTicketRows, logisticsChanged, type EventForm,
} from "./event-form";
import { londonLocalToUtcIso } from "./time";
import { validateEventForm, type EventIntent, type EventIssue } from "./schemas";

// The event editor's writes, through the Orbit API's organiser endpoints. The API enforces the
// same rules (approved organiser, payouts for paid tickets, guests on removed tickets) and tells
// guests when a live event's time or place changes; the checks here only explain things early.

export type SaveEventInput = {
  organiserId: string;
  eventId?: string | null;
  intent: EventIntent;
  form: EventForm;
};

export type SaveEventResult =
  | {
      ok: true; id: string; status: string; notified: boolean; ticketIds: string[]; questionIds: string[];
      /** Extra dates created as their own events when this event was first published. */
      datesCreated: number;
    }
  | { ok: false; error: string; issues?: EventIssue[]; id?: string };

const SIGNED_OUT = "Your session has ended. Sign in again to continue.";
const NOT_APPROVED = "Your organiser needs to be approved by the ORBIT team before you can create events.";

/** API error codes → the copy (and editor step) the editor shows. */
const SAVE_ERRORS: Record<string, { error: string; issues?: EventIssue[] }> = {
  organiser_not_approved: { error: NOT_APPROVED },
  stripe_not_ready: {
    error: "Connect payouts to sell paid tickets. Set them up in Studio → Get paid, or make every ticket free.",
    issues: [{ path: "tickets", message: "Connect payouts to sell paid tickets", step: "tickets" }],
  },
  has_registrations: {
    error: "People have already registered through ORBIT, so registration can't move off ORBIT tickets. Cancel the event instead if plans changed.",
    issues: [{ path: "registration", message: "Guests already have tickets", step: "registration" }],
  },
  ticket_type_has_guests: {
    error: "A ticket type you removed already has guests. Keep it (you can lower its quantity) or cancel those registrations first.",
    issues: [{ path: "tickets", message: "Removed ticket has guests", step: "tickets" }],
  },
  event_not_editable: { error: "This event is cancelled, so it can't be edited." },
  event_not_publishable: { error: "Only drafts can be published. Reload the page to see the event's current state." },
  date_in_past: {
    error: "One of the other dates is in the past. Remove it or pick a later date.",
    issues: [{ path: "extra_dates", message: "This date is in the past", step: "when" }],
  },
  duplicate_date: {
    error: "Two of the dates are the same. Remove the repeat and try again.",
    issues: [{ path: "extra_dates", message: "This date is already in the list", step: "when" }],
  },
  "This event has already started": {
    error: "The start time is in the past. Move it to a later time before publishing.",
    issues: [{ path: "starts_at", message: "The start time is in the past", step: "when" }],
  },
  "External registration needs a link": {
    error: "Add the link where people register.",
    issues: [{ path: "external_url", message: "Add the link where people register", step: "registration" }],
  },
  "Event not found": { error: "Event not found." },
  "Organiser not found": { error: "Organiser not found." },
};

const FORBIDDEN = "You don't have permission to do that. Only members of an approved organiser can manage its events.";
const INVALID = "Some details don't look right. Check the dates, capacity and links.";

/** A failed save as `{ error, issues }`, keeping the id of anything already saved. */
function saveFailure(error: unknown, fallback: string, id?: string): { ok: false; error: string; issues?: EventIssue[]; id?: string } {
  if (isSignedOut(error)) return { ok: false, error: SIGNED_OUT, id };
  const known = SAVE_ERRORS[apiErrorCode(error) ?? ""];
  if (known) return { ok: false, ...known, id };
  if (isApiStatus(error, 403)) return { ok: false, error: FORBIDDEN, id };
  if (isApiStatus(error, 422)) return { ok: false, error: INVALID, id };
  return { ok: false, error: apiMessage(error, {}, { fallback }), id };
}

type SavedEvent = { id: string; status: string; ticket_type_ids: string[]; question_ids: string[] };

type ExistingEvent = {
  id: string; organiser_id: string; status: string; starts_at: string; ends_at: string | null;
  venue_name: string | null; address: string | null; format: string; registration_mode: string;
};

/**
 * Creates or updates an event with its tickets, questions and private details.
 * New events are saved as drafts first and only published once every part has saved,
 * so a half-saved event is never live. On first publish, extra dates are added as their
 * own events in the same series (the API publishes them with the event).
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

  const org = (await getMyOrganisers()).find((o) => o.id === organiserId);
  if (!org) return { ok: false, error: "Organiser not found." };
  if (org.status !== "approved") return { ok: false, error: NOT_APPROVED };

  let existing: ExistingEvent | null = null;
  if (eventId) {
    try {
      existing = (await authed.get<{ event: ExistingEvent }>(`/organiser/events/${eventId}`)).event;
    } catch (error) {
      return saveFailure(error, "Event not found.");
    }
    if (existing.organiser_id !== organiserId) return { ok: false, error: "Event not found." };
    if (existing.status === "cancelled" || existing.status === "removed") {
      return { ok: false, error: "This event is cancelled, so it can't be edited." };
    }
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

  // External and info-only events send the price shown on their card; a ticketed event's
  // range follows its ticket types (the API ignores the columns there).
  const row = formToEventRow(form);
  const body = {
    ...row,
    ticket_types: formToTicketRows(form),
    questions: formToQuestionRows(form),
    private: formToPrivateRow(form),
  };

  // 1. The event, its tickets, questions and private details, in one call.
  let saved: SavedEvent;
  try {
    saved = existing
      ? await authed.patch<SavedEvent>(`/organiser/events/${existing.id}`, { body })
      : await authed.post<SavedEvent>("/organiser/events", { body: { ...body, organiser_id: organiserId } });
  } catch (error) {
    return saveFailure(error, existing ? "We couldn't save the event. Please try again." : "We couldn't create the event. Please try again.", existing?.id);
  }
  const id = saved.id;
  let status = saved.status;

  // 2. Go live.
  if (intent === "publish" && !wasPublished) {
    try {
      status = (await authed.post<{ status: string }>(`/organiser/events/${id}/publish`)).status;
    } catch (error) {
      revalidatePath("/organiser", "layout");
      const failed = saveFailure(error, "Saved as a draft, but we couldn't publish it.", id);
      return { ...failed, error: `Saved as a draft. ${failed.error}` };
    }
  }

  // 3. More dates: on first publish, one more event per date, linked to this one as a series.
  let datesCreated = 0;
  if (intent === "publish" && !wasPublished && form.extra_dates.length > 0) {
    const dates = form.extra_dates.map((d) => ({ starts_at: londonLocalToUtcIso(d.starts_at)!, ends_at: londonLocalToUtcIso(d.ends_at) }));
    try {
      datesCreated = (await authed.post<{ count: number }>(`/organiser/events/${id}/dates`, { body: { dates } })).count;
    } catch (error) {
      revalidatePath("/", "layout");
      const failed = saveFailure(error, "We couldn't add the other dates. Please try again.", id);
      return { ...failed, error: `Your event is live, but the other dates weren't added. ${failed.error}` };
    }
  }

  // 4. The API tells guests if a live event's time or place moved.
  const notified = Boolean(existing && wasPublished && logisticsChanged(existing, row));

  revalidatePath("/", "layout");
  return {
    ok: true, id, status, notified, ticketIds: saved.ticket_type_ids ?? [], questionIds: saved.question_ids ?? [], datesCreated,
  };
}

/** Cancels a published event (guests are told) — it stays visible, marked cancelled. */
export async function cancelEvent(eventId: string, reason: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = z
    .object({ id: z.uuid(), reason: z.string().trim().min(3, "Tell guests why (a few words is fine)").max(500, "Keep the reason under 500 characters") })
    .safeParse({ id: eventId, reason });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    await authed.post(`/organiser/events/${parsed.data.id}/cancel`, { body: { reason: parsed.data.reason } });
  } catch (error) {
    if (isSignedOut(error)) return { ok: false, error: SIGNED_OUT };
    return {
      ok: false,
      error: apiMessage(
        error,
        { event_not_published: "Only published events you manage can be cancelled." },
        { fallback: "We couldn't cancel the event. Please try again." },
      ),
    };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

/** Deletes a draft (published events are cancelled instead, so guests aren't left hanging). */
export async function deleteDraftEvent(eventId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = z.uuid().safeParse(eventId);
  if (!id.success) return { ok: false, error: "Event not found." };

  try {
    await authed.del(`/organiser/events/${id.data}`);
  } catch (error) {
    if (isSignedOut(error)) return { ok: false, error: SIGNED_OUT };
    if (isConflict(error)) return { ok: false, error: "Only drafts can be deleted. Cancel a published event instead." };
    return { ok: false, error: apiMessage(error, {}, { fallback: "We couldn't delete the draft. Please try again." }) };
  }

  revalidatePath("/organiser", "layout");
  return { ok: true };
}
