import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { channelsAvailable } from "./channels";
import { deliver, loadRecipients, selectIn } from "./deliver";
import { deadlineReminderMessage, eventReminderMessage, type MessageEvent } from "./messages";
import {
  DEADLINE_WINDOW_HOURS,
  logKey,
  maxReminderWindowHours,
  planReminders,
  type Channel,
  type PlanEvent,
  type PlanMark,
  type PlanRegistration,
} from "./plan";

export type ReminderSummary = {
  events: number;
  reminders: number;
  pushSent: number;
  emailsSent: number;
  skipped: number;
  failed: number;
};

const EVENT_COLUMNS =
  "id, title, starts_at, ends_at, format, venue_name, address, registration_deadline, registration_mode, external_label, status";

type ReminderEvent = PlanEvent & MessageEvent;

/** One run of the daily reminders cron: event reminders + registration-deadline reminders. */
export async function runReminders(now = new Date()): Promise<ReminderSummary> {
  const admin = createAdminClient();
  const hour = 36e5;
  const nowIso = now.toISOString();
  const eventsUntil = new Date(now.getTime() + maxReminderWindowHours() * hour).toISOString();
  const deadlinesUntil = new Date(now.getTime() + DEADLINE_WINDOW_HOURS * hour).toISOString();

  const [soon, closing] = await Promise.all([
    admin.from("events").select(EVENT_COLUMNS).eq("status", "published")
      .gt("starts_at", nowIso).lte("starts_at", eventsUntil),
    admin.from("events").select(EVENT_COLUMNS).eq("status", "published").gt("starts_at", nowIso)
      .gt("registration_deadline", nowIso).lte("registration_deadline", deadlinesUntil),
  ]);
  if (soon.error) throw new Error(`events: ${soon.error.message}`);
  if (closing.error) throw new Error(`events: ${closing.error.message}`);

  const byId = new Map<string, ReminderEvent>();
  for (const e of [...(soon.data ?? []), ...(closing.data ?? [])] as ReminderEvent[]) byId.set(e.id, e);
  const events = [...byId.values()];
  const empty = { events: 0, reminders: 0, pushSent: 0, emailsSent: 0, skipped: 0, failed: 0 };
  if (events.length === 0) return empty;
  const eventIds = events.map((e) => e.id);

  const [registrations, marks, log] = await Promise.all([
    selectIn<PlanRegistration>(admin, "registrations", "id, event_id, user_id, status", "event_id", eventIds),
    selectIn<PlanMark>(admin, "user_events", "event_id, user_id, kind", "event_id", eventIds, {
      kind: ["saved", "external_registered", "dismissed"],
    }),
    selectIn<{ user_id: string; event_id: string; kind: string; channel: Channel }>(
      admin, "notification_log", "user_id, event_id, kind, channel", "event_id", eventIds,
      { kind: ["event_reminder", "deadline_reminder"] },
    ),
  ]);

  const userIds = [...new Set([...registrations.map((r) => r.user_id), ...marks.map((m) => m.user_id)])];
  if (userIds.length === 0) return { ...empty, events: events.length };
  const recipients = await loadRecipients(admin, userIds);

  const available = channelsAvailable();
  if (!available.email) console.info("[notifications] email not configured (SMTP_* or RESEND_API_KEY): reminders go by push only");
  if (!available.push) console.info("[notifications] VAPID keys not set: reminders go by email only");

  const plan = planReminders({
    now,
    events,
    registrations,
    marks,
    preferences: recipients.preferences,
    pushUsers: new Set([...recipients.subscriptions.keys()]),
    emailUsers: new Set([...recipients.emails.keys()]),
    sent: new Set(log.map((l) => logKey(l.user_id, l.event_id, l.kind, l.channel))),
    channelsAvailable: available,
  });

  const result = await deliver(
    admin,
    plan.deliveries.map((d) => {
      const event = byId.get(d.eventId)!;
      return {
        userId: d.userId,
        eventId: d.eventId,
        registrationId: d.registrationId,
        kind: d.kind,
        channels: d.channels,
        message: d.kind === "deadline_reminder" ? deadlineReminderMessage(event, now) : eventReminderMessage(event, d.audience, now),
      };
    }),
    recipients,
  );

  return {
    events: events.length,
    reminders: plan.deliveries.length,
    pushSent: result.pushSent,
    emailsSent: result.emailsSent,
    skipped: plan.skipped + result.skipped,
    failed: result.failed,
  };
}
