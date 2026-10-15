import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl, sendEmails, sendPush, type StoredSubscription } from "./channels";
import type { Message } from "./messages";
import { DEFAULT_PREFERENCES, logKey, type Channel, type Preferences } from "./plan";
import { renderEmail } from "./templates";

// Shared delivery pipeline: claim a notification_log row per (user, event, kind, channel),
// send, and release the claim if sending failed so a later run can retry.

export type Recipients = {
  preferences: Map<string, Preferences>;
  subscriptions: Map<string, StoredSubscription[]>;
  emails: Map<string, string>;
};

const CHUNK = 100;

/** `select … where column in (ids)` in chunks, so long id lists don't blow the URL limit. */
export async function selectIn<T>(
  admin: SupabaseClient,
  table: string,
  columns: string,
  column: string,
  ids: string[],
  alsoIn: Record<string, string[]> = {},
): Promise<T[]> {
  const out: T[] = [];
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += CHUNK) {
    let q = admin.from(table).select(columns).in(column, unique.slice(i, i + CHUNK));
    for (const [col, values] of Object.entries(alsoIn)) q = q.in(col, values);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as T[]));
  }
  return out;
}

/** Preferences, push devices and email addresses for a set of users. */
export async function loadRecipients(admin: SupabaseClient, userIds: string[]): Promise<Recipients> {
  const [prefs, subs, profiles] = await Promise.all([
    selectIn<Preferences & { user_id: string }>(
      admin, "notification_preferences",
      "user_id, push_enabled, email_enabled, remind_before_hours, deadline_reminders", "user_id", userIds,
    ),
    selectIn<StoredSubscription & { user_id: string }>(
      admin, "push_subscriptions", "user_id, endpoint, p256dh, auth", "user_id", userIds,
    ),
    selectIn<{ id: string; email: string | null }>(admin, "profiles", "id, email", "id", userIds),
  ]);

  const preferences = new Map<string, Preferences>();
  for (const p of prefs) {
    preferences.set(p.user_id, {
      push_enabled: p.push_enabled,
      email_enabled: p.email_enabled,
      remind_before_hours: p.remind_before_hours,
      deadline_reminders: p.deadline_reminders,
    });
  }
  const subscriptions = new Map<string, StoredSubscription[]>();
  for (const s of subs) {
    const list = subscriptions.get(s.user_id) ?? [];
    list.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    subscriptions.set(s.user_id, list);
  }
  const emails = new Map<string, string>();
  for (const p of profiles) if (p.email) emails.set(p.id, p.email);
  return { preferences, subscriptions, emails };
}

export function prefsOf(r: Recipients, userId: string) {
  return r.preferences.get(userId) ?? DEFAULT_PREFERENCES;
}

export type DeliveryJob = {
  userId: string;
  eventId: string;
  registrationId: string | null;
  kind: string;
  channels: Channel[];
  message: Message;
};

export type DeliveryResult = { pushSent: number; emailsSent: number; skipped: number; failed: number };

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await fn(items[next++]);
  });
  await Promise.all(workers);
}

export async function deliver(
  admin: SupabaseClient,
  jobs: DeliveryJob[],
  recipients: Recipients,
): Promise<DeliveryResult> {
  const result: DeliveryResult = { pushSent: 0, emailsSent: 0, skipped: 0, failed: 0 };

  // 1. Claim every (user, event, kind, channel) we intend to send. Existing rows = already sent.
  const rows = jobs.flatMap((j) =>
    j.channels.map((channel) => ({
      user_id: j.userId, event_id: j.eventId, registration_id: j.registrationId, kind: j.kind, channel,
    })),
  );
  const claimed = new Map<string, number>();
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await admin
      .from("notification_log")
      .upsert(rows.slice(i, i + 500), { onConflict: "user_id,event_id,kind,channel", ignoreDuplicates: true })
      .select("id, user_id, event_id, kind, channel");
    if (error) throw new Error(`notification_log: ${error.message}`);
    for (const r of data ?? []) claimed.set(logKey(r.user_id, r.event_id, r.kind, r.channel), r.id);
  }
  result.skipped += rows.length - claimed.size;

  const release: number[] = [];
  const claimOf = (j: DeliveryJob, c: Channel) => claimed.get(logKey(j.userId, j.eventId, j.kind, c));

  // 2. Push, a few people at a time.
  const pushJobs = jobs.filter((j) => j.channels.includes("push") && claimOf(j, "push") !== undefined);
  await mapLimit(pushJobs, 8, async (j) => {
    const subs = recipients.subscriptions.get(j.userId) ?? [];
    const r = await sendPush(admin, subs, j.message);
    if (r.delivered > 0) result.pushSent++;
    else {
      if (r.failed > 0) result.failed++;
      else result.skipped++; // every device had expired
      release.push(claimOf(j, "push")!);
    }
  });

  // 3. Email, batched.
  const claimedEmail = jobs.filter((j) => j.channels.includes("email") && claimOf(j, "email") !== undefined);
  const emailJobs = claimedEmail.filter((j) => recipients.emails.has(j.userId));
  for (const j of claimedEmail) {
    if (recipients.emails.has(j.userId)) continue;
    result.skipped++;
    release.push(claimOf(j, "email")!);
  }
  const base = appUrl();
  const sent = await sendEmails(
    emailJobs.map((j) => ({ to: recipients.emails.get(j.userId)!, email: renderEmail(j.message, base) })),
  );
  sent.forEach((ok, i) => {
    if (ok) result.emailsSent++;
    else {
      result.failed++;
      release.push(claimOf(emailJobs[i], "email")!);
    }
  });

  // 4. Let failed sends be retried next time.
  for (let i = 0; i < release.length; i += CHUNK) {
    const { error } = await admin.from("notification_log").delete().in("id", release.slice(i, i + CHUNK));
    if (error) console.error("[notifications] couldn't release log rows", error.message);
  }

  return result;
}
