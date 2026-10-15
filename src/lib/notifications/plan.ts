// Pure selection logic: who gets which notification. No I/O, so it is unit-tested directly.

export type Channel = "push" | "email";

export type Preferences = {
  push_enabled: boolean;
  email_enabled: boolean;
  remind_before_hours: number;
  deadline_reminders: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  push_enabled: true,
  email_enabled: true,
  remind_before_hours: 24,
  deadline_reminders: true,
};

/** The reminder timings a user can pick. */
export const REMIND_BEFORE_OPTIONS = [24, 2] as const;

/** The reminders cron runs once a day (vercel.json: 08:00 UTC). */
export const CRON_INTERVAL_HOURS = 24;

/** Deadline reminders go out for registration deadlines within this many hours. */
export const DEADLINE_WINDOW_HOURS = 48;

/** Registration statuses that still hold (or wait for) a place. */
export const ACTIVE_REGISTRATION_STATUSES = ["going", "pending", "waitlisted", "awaiting_payment"] as const;

export type PlanEvent = {
  id: string;
  title: string;
  starts_at: string;
  registration_deadline: string | null;
  status: string;
  registration_mode: string;
};

export type PlanRegistration = { id: string; event_id: string; user_id: string; status: string };
export type PlanMark = { event_id: string; user_id: string; kind: string };

/** Why someone is being reminded — picks the wording. */
export type Audience = "going" | "unpaid" | "saved";

export type ReminderKind = "event_reminder" | "deadline_reminder";

export type PlannedDelivery = {
  userId: string;
  eventId: string;
  registrationId: string | null;
  kind: ReminderKind;
  audience: Audience;
  channels: Channel[];
};

export type ReminderInput = {
  now: Date;
  events: PlanEvent[];
  registrations: PlanRegistration[];
  marks: PlanMark[];
  /** Users without a row get DEFAULT_PREFERENCES. */
  preferences: Map<string, Preferences>;
  /** Users with at least one push subscription. */
  pushUsers: Set<string>;
  /** Users with an email address. */
  emailUsers: Set<string>;
  /** Already sent: logKey(user, event, kind, channel). */
  sent: Set<string>;
  /** Whether each channel is configured on the server at all. */
  channelsAvailable?: { push: boolean; email: boolean };
  cronIntervalHours?: number;
};

export function logKey(userId: string, eventId: string, kind: string, channel: Channel) {
  return `${userId}:${eventId}:${kind}:${channel}`;
}

/**
 * How far ahead (in hours) an event reminder can go out for someone who wants it
 * `remindBefore` hours ahead, when the cron only runs every `interval` hours.
 *
 * We send at the run closest to the requested time: anything starting within
 * `remindBefore + interval / 2` hours. The window is never shorter than one interval,
 * so every event is caught by at least one run. With the daily cron:
 *   24h → events in the next 36h (the day before, or the same morning if added late)
 *    2h → events in the next 24h (the morning of the event)
 */
export function reminderWindowHours(remindBefore: number, interval = CRON_INTERVAL_HOURS) {
  return Math.max(remindBefore + interval / 2, interval);
}

/** The widest reminder window across all options — what the cron needs to load. */
export function maxReminderWindowHours(interval = CRON_INTERVAL_HOURS) {
  return Math.max(...REMIND_BEFORE_OPTIONS.map((h) => reminderWindowHours(h, interval)));
}

const HOUR = 36e5;

function hoursUntil(iso: string, now: Date) {
  return (new Date(iso).getTime() - now.getTime()) / HOUR;
}

/** Channels this person can get right now, given their preferences and devices. */
export function channelsFor(
  userId: string,
  prefs: Preferences,
  pushUsers: Set<string>,
  emailUsers: Set<string>,
  available: { push: boolean; email: boolean } = { push: true, email: true },
): Channel[] {
  const channels: Channel[] = [];
  if (available.push && prefs.push_enabled && pushUsers.has(userId)) channels.push("push");
  if (available.email && prefs.email_enabled && emailUsers.has(userId)) channels.push("email");
  return channels;
}

type Relation = {
  registration?: PlanRegistration;
  saved: boolean;
  externalRegistered: boolean;
  dismissed: boolean;
};

function relations(events: PlanEvent[], registrations: PlanRegistration[], marks: PlanMark[]) {
  const ids = new Set(events.map((e) => e.id));
  const byEvent = new Map<string, Map<string, Relation>>();
  const get = (eventId: string, userId: string) => {
    let users = byEvent.get(eventId);
    if (!users) byEvent.set(eventId, (users = new Map()));
    let rel = users.get(userId);
    if (!rel) users.set(userId, (rel = { saved: false, externalRegistered: false, dismissed: false }));
    return rel;
  };
  for (const r of registrations) if (ids.has(r.event_id)) get(r.event_id, r.user_id).registration = r;
  for (const m of marks) {
    if (!ids.has(m.event_id)) continue;
    const rel = get(m.event_id, m.user_id);
    if (m.kind === "saved") rel.saved = true;
    if (m.kind === "external_registered") rel.externalRegistered = true;
    if (m.kind === "dismissed") rel.dismissed = true;
  }
  return byEvent;
}

/** Who an event reminder is for, and why — or null for nobody. */
export function eventReminderAudience(rel: Relation): Audience | null {
  const status = rel.registration?.status;
  if (status === "going" || rel.externalRegistered) return "going";
  if (status === "awaiting_payment") return "unpaid";
  // Pending / waitlisted people hear when their status changes; cancelled / declined chose or got a no.
  if (status) return null;
  if (rel.saved && !rel.dismissed) return "saved";
  return null;
}

/** Saved, not registered (in ORBIT or externally), deadline coming up. */
export function needsDeadlineReminder(rel: Relation) {
  return rel.saved && !rel.dismissed && !rel.registration && !rel.externalRegistered;
}

/**
 * Plans one run of the reminders cron.
 *  (a) Event reminders: published events starting inside the person's reminder window,
 *      for people going (or with an unpaid ticket) and people who saved them.
 *  (b) Deadline reminders: saved events with a registration deadline in the next 48h that
 *      the person hasn't registered for.
 * Channels already in the log are dropped, so running twice sends nothing new.
 */
export function planReminders(input: ReminderInput) {
  const { now, preferences, pushUsers, emailUsers, sent } = input;
  const interval = input.cronIntervalHours ?? CRON_INTERVAL_HOURS;
  const available = input.channelsAvailable ?? { push: true, email: true };
  const byEvent = relations(input.events, input.registrations, input.marks);
  const deliveries: PlannedDelivery[] = [];
  let skipped = 0;

  const add = (
    userId: string, event: PlanEvent, kind: ReminderKind, audience: Audience, rel: Relation, prefs: Preferences,
  ) => {
    const wanted = channelsFor(userId, prefs, pushUsers, emailUsers, available);
    const channels = wanted.filter((c) => !sent.has(logKey(userId, event.id, kind, c)));
    if (channels.length === 0) {
      skipped++;
      return;
    }
    deliveries.push({ userId, eventId: event.id, registrationId: rel.registration?.id ?? null, kind, audience, channels });
  };

  for (const event of input.events) {
    if (event.status !== "published") continue;
    const startsIn = hoursUntil(event.starts_at, now);
    if (startsIn <= 0) continue;
    const users = byEvent.get(event.id);
    if (!users) continue;

    const deadlineIn = event.registration_deadline ? hoursUntil(event.registration_deadline, now) : null;
    const deadlineSoon =
      deadlineIn !== null && deadlineIn > 0 && deadlineIn <= DEADLINE_WINDOW_HOURS && event.registration_mode !== "none";

    for (const [userId, rel] of users) {
      const prefs = preferences.get(userId) ?? DEFAULT_PREFERENCES;

      const audience = eventReminderAudience(rel);
      if (audience && startsIn <= reminderWindowHours(prefs.remind_before_hours, interval)) {
        add(userId, event, "event_reminder", audience, rel, prefs);
      }

      if (deadlineSoon && prefs.deadline_reminders && needsDeadlineReminder(rel)) {
        add(userId, event, "deadline_reminder", "saved", rel, prefs);
      }
    }
  }

  return { deliveries, skipped };
}

// ─── Event changes & registration changes ──────────────────────────────────

/** Everyone to tell when an event changes: active registrations + people who saved it. */
export function eventChangeRecipients(registrations: PlanRegistration[], marks: PlanMark[]) {
  const active = new Set<string>(ACTIVE_REGISTRATION_STATUSES);
  const out = new Map<string, string | null>(); // user → registration id
  for (const r of registrations) if (active.has(r.status)) out.set(r.user_id, r.id);
  const inactive = new Set(registrations.filter((r) => !active.has(r.status)).map((r) => r.user_id));
  for (const m of marks) {
    if ((m.kind === "saved" || m.kind === "external_registered") && !out.has(m.user_id) && !inactive.has(m.user_id)) {
      out.set(m.user_id, null);
    }
  }
  return out;
}

/** A short, stable fingerprint of what changed, so the same update isn't announced twice. */
export function eventChangeFingerprint(e: {
  starts_at: string; ends_at?: string | null; venue_name?: string | null; address?: string | null; format?: string | null;
}) {
  const s = [e.starts_at, e.ends_at, e.venue_name, e.address, e.format].map((v) => v ?? "").join("|");
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export type RegistrationUpdate =
  | "approved"
  | "off_waitlist"
  | "confirmed"
  | "paid"
  | "awaiting_payment"
  | "pending_review"
  | "declined";

/** A row updated well after it was created has moved (e.g. off the waitlist). */
const MOVED_AFTER_MS = 5 * 60 * 1000;

/** Works out what happened to a registration from its current row. Null = nothing to say. */
export function classifyRegistration(r: {
  status: string; decided_at: string | null; payment_status: string; created_at: string; updated_at: string;
}): RegistrationUpdate | null {
  const moved = new Date(r.updated_at).getTime() - new Date(r.created_at).getTime() > MOVED_AFTER_MS;
  switch (r.status) {
    case "going":
      if (r.payment_status === "paid") return "paid";
      if (r.decided_at) return "approved";
      return moved ? "off_waitlist" : "confirmed";
    case "awaiting_payment":
      return r.decided_at ? "approved" : moved ? "off_waitlist" : "awaiting_payment";
    case "pending":
      return "pending_review";
    case "declined":
      return "declined";
    default:
      return null; // waitlisted / cancelled: the attendee did it, or nothing changed for them
  }
}
