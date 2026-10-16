"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getCheckInCount } from "@/lib/guests/queries";
import { normaliseCode } from "@/lib/guests/scan";
import type { CheckInResult } from "@/lib/guests/types";
import { notifyRegistrationChanged } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

// Every write here goes through the SQL functions (decide_registration, check_in,
// undo_check_in), which check `can_manage_event` themselves.

type Fail = { ok: false; error: string };
type Counts = { going: number; checkedIn: number };

const id = z.guid();
const decision = z.enum(["approve", "decline"]);
const code = z.string().trim().min(1).max(200);

function refresh(eventId: string) {
  const base = `/organiser/events/${eventId}`;
  for (const path of [base, `${base}/guests`, `${base}/check-in`]) revalidatePath(path);
}

function friendly(message: string | undefined) {
  if (!message) return "Something went wrong. Try again.";
  // Raised by our SQL functions with user-facing text; hide anything else.
  return /^[A-Z][^\n]{0,160}$/.test(message) && !/violates|syntax|relation|column|function/i.test(message)
    ? message
    : "Something went wrong. Try again.";
}

async function signedIn() {
  return (await getCurrentUser()) !== null;
}

/** Waitlisted registrations for an event — used to spot who moved up after a decline. */
async function waitlistedIds(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("registrations").select("id").eq("event_id", eventId).eq("status", "waitlisted");
  return new Set((data ?? []).map((r) => r.id as string));
}

/** Approve or decline one registration. */
export async function decideRegistration(
  eventId: string, registrationId: string, choice: "approve" | "decline",
): Promise<{ ok: true; status: string } | Fail> {
  const parsed = z.object({ eventId: id, registrationId: id, choice: decision }).safeParse({ eventId, registrationId, choice });
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (!(await signedIn())) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const before = choice === "decline" ? await waitlistedIds(eventId) : null;
  const { data, error } = await supabase.rpc("decide_registration", {
    p_registration_id: registrationId, p_decision: choice,
  });
  if (error) return { ok: false, error: friendly(error.message) };

  await notifyRegistrationChanged(registrationId);
  // A decline frees a spot; the database moves people off the waitlist — tell them too.
  if (before && before.size) {
    const after = await waitlistedIds(eventId);
    await Promise.all([...before].filter((r) => !after.has(r)).map((r) => notifyRegistrationChanged(r)));
  }
  refresh(eventId);
  return { ok: true, status: (data as { status: string } | null)?.status ?? choice };
}

/** Approve everyone still awaiting a decision. Stops at the first error (e.g. the event is full). */
export async function approveAllPending(eventId: string): Promise<{ ok: true; approved: number } | Fail> {
  if (!id.safeParse(eventId).success) return { ok: false, error: "Invalid request" };
  if (!(await signedIn())) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { data: pending, error: listError } = await supabase
    .from("registrations")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "pending")
    .order("created_at");
  if (listError) return { ok: false, error: friendly(listError.message) };

  let approved = 0;
  for (const { id: registrationId } of pending ?? []) {
    const { error } = await supabase.rpc("decide_registration", { p_registration_id: registrationId, p_decision: "approve" });
    if (error) {
      refresh(eventId);
      return { ok: false, error: `Approved ${approved}. ${friendly(error.message)}` };
    }
    approved += 1;
    await notifyRegistrationChanged(registrationId);
  }
  refresh(eventId);
  return { ok: true, approved };
}

/** Door check-in from a scanned or typed ticket code. */
export async function checkInByCode(eventId: string, rawCode: string): Promise<{ ok: true; result: CheckInResult; counts: Counts } | Fail> {
  const parsed = z.object({ eventId: id, code }).safeParse({ eventId, code: rawCode });
  if (!parsed.success) return { ok: false, error: "Enter a ticket code" };
  if (!(await signedIn())) return { ok: false, error: "Sign in first" };
  const normalised = normaliseCode(parsed.data.code);
  if (!normalised) {
    return { ok: true, result: { result: "not_found" }, counts: await getCheckInCount(eventId) };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("check_in", { p_event_id: eventId, p_code: normalised });
  if (error) return { ok: false, error: friendly(error.message) };
  const result = data as CheckInResult;
  if (result.result === "checked_in") refresh(eventId);
  return { ok: true, result, counts: await getCheckInCount(eventId) };
}

/** Check a guest in from the list (no ticket to scan): looks up their code, then uses check_in. */
export async function checkInRegistration(eventId: string, registrationId: string): Promise<{ ok: true; result: CheckInResult; counts: Counts } | Fail> {
  const parsed = z.object({ eventId: id, registrationId: id }).safeParse({ eventId, registrationId });
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (!(await signedIn())) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  // RLS only returns the row to people who can manage this event.
  const { data: reg } = await supabase
    .from("registrations")
    .select("qr_code")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (!reg) return { ok: false, error: "Guest not found" };
  return checkInByCode(eventId, reg.qr_code as string);
}

/** Undo a check-in made by mistake. */
export async function undoCheckIn(eventId: string, registrationId: string): Promise<{ ok: true; counts: Counts } | Fail> {
  const parsed = z.object({ eventId: id, registrationId: id }).safeParse({ eventId, registrationId });
  if (!parsed.success) return { ok: false, error: "Invalid request" };
  if (!(await signedIn())) return { ok: false, error: "Sign in first" };

  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_check_in", { p_registration_id: registrationId });
  if (error) return { ok: false, error: friendly(error.message) };
  refresh(eventId);
  return { ok: true, counts: await getCheckInCount(eventId) };
}
