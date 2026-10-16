import "server-only";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl, channelsAvailable, isEmailConfigured, sendEmails } from "./channels";
import { deliver, loadRecipients, prefsOf, selectIn } from "./deliver";
import { eventChangedMessage, organiserDecisionMessage, registrationMessage, type MessageEvent } from "./messages";
import { renderEmail } from "./templates";
import {
  channelsFor,
  classifyRegistration,
  eventChangeFingerprint,
  eventChangeRecipients,
  type PlanMark,
  type PlanRegistration,
} from "./plan";

// Notifications. Features call these after the change has been saved; they never throw.
// Sending runs after the response when called from a request (Server Action / route), so the
// organiser's action isn't held up by push/email round-trips.

const EVENT_COLUMNS =
  "id, title, starts_at, ends_at, format, venue_name, address, registration_deadline, registration_mode, external_label, status, cancel_reason";

type LoadedEvent = MessageEvent & { status: string };

function inBackground(label: string, task: () => Promise<void>) {
  const run = async () => {
    try {
      await task();
    } catch (err) {
      console.error(`[notifications] ${label} failed`, err);
    }
  };
  try {
    after(run);
    return Promise.resolve();
  } catch {
    // Outside a request (scripts, tests): just run it.
    return run();
  }
}

/** An event's time/place changed, or it was cancelled → tell everyone registered or who saved it. */
export async function notifyEventChanged(eventId: string, change: "updated" | "cancelled") {
  return inBackground(`notifyEventChanged(${eventId}, ${change})`, () => sendEventChanged(eventId, change));
}

/** An organiser approved/declined someone, someone moved off the waitlist, or a payment landed. */
export async function notifyRegistrationChanged(registrationId: string) {
  return inBackground(`notifyRegistrationChanged(${registrationId})`, () => sendRegistrationChanged(registrationId));
}

/**
 * An admin approved or rejected an organisation → email its owners. Runs after the response and
 * never throws; without an email channel configured (local dev) it only logs.
 */
export async function notifyOrganiserDecision(organiserId: string) {
  return inBackground(`notifyOrganiserDecision(${organiserId})`, () => sendOrganiserDecision(organiserId));
}

async function sendOrganiserDecision(organiserId: string) {
  const admin = createAdminClient();
  const { data: org, error } = await admin
    .from("organisers")
    .select("id, name, status, review_note")
    .eq("id", organiserId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org || (org.status !== "approved" && org.status !== "rejected")) return;

  const { data: owners, error: ownersError } = await admin
    .from("organiser_members")
    .select("user_id")
    .eq("organiser_id", organiserId)
    .eq("role", "owner");
  if (ownersError) throw new Error(ownersError.message);
  const ids = (owners ?? []).map((o) => o.user_id as string);
  if (ids.length === 0) return;

  const { data: profiles, error: profilesError } = await admin.from("profiles").select("email").in("id", ids);
  if (profilesError) throw new Error(profilesError.message);
  const emails = [...new Set((profiles ?? []).map((p) => p.email as string | null).filter((e): e is string => !!e))];
  if (emails.length === 0) return;

  if (!isEmailConfigured()) {
    console.info(`[notifications] organiser ${org.status} email skipped (no email channel): ${emails.length} owner(s)`);
    return;
  }
  const rendered = renderEmail(organiserDecisionMessage(org, org.status), appUrl());
  const ok = await sendEmails(emails.map((to) => ({ to, email: rendered })));
  console.info(`[notifications] organiser ${org.status} ${organiserId}:`, `${ok.filter(Boolean).length}/${ok.length} emailed`);
}

async function sendEventChanged(eventId: string, change: "updated" | "cancelled") {
  const admin = createAdminClient();
  const { data, error } = await admin.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  if (error) throw new Error(error.message);
  const event = data as LoadedEvent | null;
  if (!event) return;
  if (change === "updated" && event.status !== "published") return;
  if (new Date(event.ends_at ?? event.starts_at).getTime() < Date.now()) return;

  const [registrations, marks] = await Promise.all([
    selectIn<PlanRegistration>(admin, "registrations", "id, event_id, user_id, status", "event_id", [eventId]),
    selectIn<PlanMark>(admin, "user_events", "event_id, user_id, kind", "event_id", [eventId], {
      kind: ["saved", "external_registered"],
    }),
  ]);
  const people = eventChangeRecipients(registrations, marks);
  if (people.size === 0) return;

  const recipients = await loadRecipients(admin, [...people.keys()]);
  const available = channelsAvailable();
  const pushUsers = new Set(recipients.subscriptions.keys());
  const emailUsers = new Set(recipients.emails.keys());
  const kind = change === "cancelled" ? "event_cancelled" : `event_updated:${eventChangeFingerprint(event)}`;
  const message = eventChangedMessage(event, change);

  const jobs = [...people].map(([userId, registrationId]) => ({
    userId,
    eventId,
    registrationId,
    kind,
    channels: channelsFor(userId, prefsOf(recipients, userId), pushUsers, emailUsers, available),
    message,
  }));
  const result = await deliver(admin, jobs.filter((j) => j.channels.length > 0), recipients);
  console.info(`[notifications] event ${change} ${eventId}:`, result);
}

async function sendRegistrationChanged(registrationId: string) {
  const admin = createAdminClient();
  const { data: reg, error } = await admin
    .from("registrations")
    .select("id, event_id, user_id, status, decided_at, payment_status, created_at, updated_at")
    .eq("id", registrationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!reg) return;

  const update = classifyRegistration(reg);
  if (!update) return;

  const { data, error: eventError } = await admin.from("events").select(EVENT_COLUMNS).eq("id", reg.event_id).maybeSingle();
  if (eventError) throw new Error(eventError.message);
  const event = data as LoadedEvent | null;
  if (!event || event.status === "cancelled") return;
  if (new Date(event.ends_at ?? event.starts_at).getTime() < Date.now()) return;

  const recipients = await loadRecipients(admin, [reg.user_id]);
  const channels = channelsFor(
    reg.user_id,
    prefsOf(recipients, reg.user_id),
    new Set(recipients.subscriptions.keys()),
    new Set(recipients.emails.keys()),
    channelsAvailable(),
  );
  if (channels.length === 0) return;

  const result = await deliver(
    admin,
    [{
      userId: reg.user_id,
      eventId: reg.event_id,
      registrationId: reg.id,
      kind: `registration_${reg.status}`,
      channels,
      message: registrationMessage(event, update, reg.status),
    }],
    recipients,
  );
  console.info(`[notifications] registration ${reg.status} ${registrationId}:`, result);
}
