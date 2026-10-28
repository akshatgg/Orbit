"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { apiMessage } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { getCheckInCount } from "@/lib/guests/queries";
import { normaliseCode } from "@/lib/guests/scan";
import type { CheckInResult } from "@/lib/guests/types";

// Every write goes through the Orbit API's organiser endpoints, which check the caller
// can manage the event and tell guests about decisions and waitlist moves.

type Fail = { ok: false; error: string };
type Counts = { going: number; checkedIn: number };

const GENERIC = "Something went wrong. Try again.";
const id = z.guid();
const decision = z.enum(["approve", "decline"]);
const code = z.string().trim().min(1).max(200);

function refresh(eventId: string) {
  const base = `/organiser/events/${eventId}`;
  for (const path of [base, `${base}/guests`, `${base}/check-in`]) revalidatePath(path);
}

/** The API's own sentence (e.g. "This event is full") or a generic retry message. */
const FULL = "The event is full. Increase the capacity to approve more people.";

function friendly(error: unknown) {
  return apiMessage(
    error,
    { event_full: FULL, "Registration not found": "Guest not found" },
    { fallback: GENERIC, passThrough: true },
  );
}

/** Approve or decline one registration. */
export async function decideRegistration(
  eventId: string, registrationId: string, choice: "approve" | "decline",
): Promise<{ ok: true; status: string } | Fail> {
  const parsed = z.object({ eventId: id, registrationId: id, choice: decision }).safeParse({ eventId, registrationId, choice });
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const row = await authed.post<{ status?: string } | null>(
      `/organiser/events/${eventId}/registrations/${registrationId}/decision`,
      { body: { decision: choice } },
    );
    refresh(eventId);
    return { ok: true, status: row?.status ?? choice };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}

/** Approve everyone still awaiting a decision. Stops at the first refusal (e.g. the event is full). */
export async function approveAllPending(eventId: string): Promise<{ ok: true; approved: number } | Fail> {
  if (!id.safeParse(eventId).success) return { ok: false, error: "Invalid request" };

  try {
    const result = await authed.post<{ ok: boolean; approved: number; total: number; error?: string | null }>(
      `/organiser/events/${eventId}/registrations/approve-all`,
    );
    refresh(eventId);
    if (result.ok) return { ok: true, approved: result.approved };
    // A partial stop: earlier approvals are kept, the rest stay pending.
    const reason = result.error === "event_full" ? FULL : result.error || GENERIC;
    return { ok: false, error: `Approved ${result.approved}. ${reason}` };
  } catch (error) {
    refresh(eventId);
    return { ok: false, error: friendly(error) };
  }
}

type CheckInPayload = CheckInResult & { ok?: boolean };

/** The API adds `ok` to check_in()'s result; the door screen only needs the result itself. */
function asResult(payload: CheckInPayload): CheckInResult {
  const result: CheckInPayload = { ...payload, result: payload.result ?? "not_found" };
  delete result.ok;
  return result;
}

/** Door check-in from a scanned or typed ticket code. */
export async function checkInByCode(eventId: string, rawCode: string): Promise<{ ok: true; result: CheckInResult; counts: Counts } | Fail> {
  const parsed = z.object({ eventId: id, code }).safeParse({ eventId, code: rawCode });
  if (!parsed.success) return { ok: false, error: "Enter a ticket code" };
  const normalised = normaliseCode(parsed.data.code);

  try {
    if (!normalised) {
      return { ok: true, result: { result: "not_found" }, counts: await getCheckInCount(eventId) };
    }
    const payload = await authed.post<CheckInPayload>(`/organiser/events/${eventId}/check-in`, { body: { code: normalised } });
    const result = asResult(payload);
    if (result.result === "checked_in") refresh(eventId);
    return { ok: true, result, counts: await getCheckInCount(eventId) };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}

/** Check a guest in from the list (no ticket to scan): the API looks up their code. */
export async function checkInRegistration(eventId: string, registrationId: string): Promise<{ ok: true; result: CheckInResult; counts: Counts } | Fail> {
  const parsed = z.object({ eventId: id, registrationId: id }).safeParse({ eventId, registrationId });
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    const payload = await authed.post<CheckInPayload>(`/organiser/events/${eventId}/check-in/by-registration`, {
      body: { registration_id: registrationId },
    });
    const result = asResult(payload);
    if (result.result === "checked_in") refresh(eventId);
    return { ok: true, result, counts: await getCheckInCount(eventId) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { ok: false, error: "Guest not found" };
    return { ok: false, error: friendly(error) };
  }
}

/** Undo a check-in made by mistake. */
export async function undoCheckIn(eventId: string, registrationId: string): Promise<{ ok: true; counts: Counts } | Fail> {
  const parsed = z.object({ eventId: id, registrationId: id }).safeParse({ eventId, registrationId });
  if (!parsed.success) return { ok: false, error: "Invalid request" };

  try {
    await authed.del(`/organiser/events/${eventId}/check-in/${registrationId}`);
    refresh(eventId);
    return { ok: true, counts: await getCheckInCount(eventId) };
  } catch (error) {
    return { ok: false, error: friendly(error) };
  }
}
