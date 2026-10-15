import { describe, expect, it } from "vitest";
import {
  channelsFor,
  classifyRegistration,
  DEFAULT_PREFERENCES,
  eventChangeFingerprint,
  eventChangeRecipients,
  logKey,
  maxReminderWindowHours,
  planReminders,
  reminderWindowHours,
  type PlanEvent,
  type PlanMark,
  type PlanRegistration,
  type Preferences,
  type ReminderInput,
} from "./plan";

const NOW = new Date("2026-10-16T08:00:00Z"); // the daily cron
const at = (hours: number) => new Date(NOW.getTime() + hours * 36e5).toISOString();

function ev(id: string, startsInHours: number, extra: Partial<PlanEvent> = {}): PlanEvent {
  return {
    id, title: id, starts_at: at(startsInHours), registration_deadline: null,
    status: "published", registration_mode: "tickets", ...extra,
  };
}
const reg = (event_id: string, user_id: string, status: string): PlanRegistration => ({
  id: `r-${event_id}-${user_id}`, event_id, user_id, status,
});
const mark = (event_id: string, user_id: string, kind = "saved"): PlanMark => ({ event_id, user_id, kind });

function input(over: Partial<ReminderInput>): ReminderInput {
  return {
    now: NOW,
    events: [],
    registrations: [],
    marks: [],
    preferences: new Map(),
    pushUsers: new Set(["u1", "u2", "u3", "u4"]),
    emailUsers: new Set(["u1", "u2", "u3", "u4"]),
    sent: new Set(),
    ...over,
  };
}

const keyOf = (d: { userId: string; eventId: string; kind: string }) => `${d.userId}/${d.eventId}/${d.kind}`;

describe("reminder windows", () => {
  it("covers the next ~36h for 24h reminders and the next 24h for 2h reminders with a daily cron", () => {
    expect(reminderWindowHours(24)).toBe(36);
    expect(reminderWindowHours(2)).toBe(24);
    expect(maxReminderWindowHours()).toBe(36);
  });
  it("tightens when the cron runs more often", () => {
    expect(reminderWindowHours(2, 1)).toBe(2.5);
    expect(reminderWindowHours(24, 1)).toBe(24.5);
  });
});

describe("planReminders: event reminders", () => {
  it("reminds people going and people who saved, inside the window only", () => {
    const { deliveries } = planReminders(input({
      events: [ev("soon", 10), ev("tomorrow", 30), ev("later", 40)],
      registrations: [reg("soon", "u1", "going"), reg("tomorrow", "u1", "going"), reg("later", "u1", "going")],
      marks: [mark("tomorrow", "u2")],
    }));
    expect(deliveries.map(keyOf).sort()).toEqual([
      "u1/soon/event_reminder",
      "u1/tomorrow/event_reminder",
      "u2/tomorrow/event_reminder",
    ]);
    const u1 = deliveries.find((d) => d.userId === "u1" && d.eventId === "soon")!;
    expect(u1.audience).toBe("going");
    expect(u1.registrationId).toBe("r-soon-u1");
    expect(u1.channels).toEqual(["push", "email"]);
    expect(deliveries.find((d) => d.userId === "u2")!.audience).toBe("saved");
  });

  it("uses the person's timing: 2h people hear on the day, 24h people the day before", () => {
    const prefs = new Map<string, Preferences>([["u2", { ...DEFAULT_PREFERENCES, remind_before_hours: 2 }]]);
    const { deliveries } = planReminders(input({
      events: [ev("today", 9), ev("tomorrow", 30)],
      registrations: ["today", "tomorrow"].flatMap((e) => [reg(e, "u1", "going"), reg(e, "u2", "going")]),
      preferences: prefs,
    }));
    expect(deliveries.map(keyOf).sort()).toEqual([
      "u1/today/event_reminder",
      "u1/tomorrow/event_reminder",
      "u2/today/event_reminder",
    ]);
  });

  it("skips past, cancelled and draft events", () => {
    const { deliveries } = planReminders(input({
      events: [ev("past", -1), ev("cancelled", 5, { status: "cancelled" }), ev("draft", 5, { status: "draft" })],
      registrations: [reg("past", "u1", "going"), reg("cancelled", "u1", "going"), reg("draft", "u1", "going")],
    }));
    expect(deliveries).toEqual([]);
  });

  it("picks the right audience for each registration status", () => {
    const { deliveries } = planReminders(input({
      events: [ev("e", 12)],
      registrations: [
        reg("e", "u1", "awaiting_payment"),
        reg("e", "u2", "waitlisted"),
        reg("e", "u3", "cancelled"),
        reg("e", "u4", "declined"),
      ],
      // Saving doesn't override a cancelled/declined/waitlisted registration.
      marks: [mark("e", "u2"), mark("e", "u3"), mark("e", "u4")],
    }));
    expect(deliveries.map((d) => [d.userId, d.audience])).toEqual([["u1", "unpaid"]]);
  });

  it("treats 'I registered on their site' as going, and ignores dismissed saves", () => {
    const { deliveries } = planReminders(input({
      events: [ev("ext", 12, { registration_mode: "external" }), ev("e2", 12)],
      marks: [mark("ext", "u1", "external_registered"), mark("e2", "u2"), mark("e2", "u2", "dismissed")],
    }));
    expect(deliveries.map((d) => [d.userId, d.eventId, d.audience])).toEqual([["u1", "ext", "going"]]);
  });

  it("respects channel preferences and missing devices / addresses", () => {
    const prefs = new Map<string, Preferences>([
      ["u1", { ...DEFAULT_PREFERENCES, email_enabled: false }],
      ["u2", { ...DEFAULT_PREFERENCES, push_enabled: false, email_enabled: false }],
    ]);
    const { deliveries, skipped } = planReminders(input({
      events: [ev("e", 12)],
      registrations: [reg("e", "u1", "going"), reg("e", "u2", "going"), reg("e", "u3", "going")],
      preferences: prefs,
      pushUsers: new Set(["u1", "u2"]),
      emailUsers: new Set(["u1", "u2", "u3"]),
    }));
    expect(deliveries.map((d) => [d.userId, d.channels])).toEqual([
      ["u1", ["push"]],
      ["u3", ["email"]],
    ]);
    expect(skipped).toBe(1);
  });

  it("drops channels the server can't send on", () => {
    const { deliveries } = planReminders(input({
      events: [ev("e", 12)],
      registrations: [reg("e", "u1", "going")],
      channelsAvailable: { push: true, email: false },
    }));
    expect(deliveries[0].channels).toEqual(["push"]);
  });

  it("dedupes against the log, per channel", () => {
    const base = {
      events: [ev("e", 12)],
      registrations: [reg("e", "u1", "going"), reg("e", "u2", "going")],
    };
    const first = planReminders(input(base));
    expect(first.deliveries).toHaveLength(2);

    const sent = new Set([
      logKey("u1", "e", "event_reminder", "push"),
      logKey("u1", "e", "event_reminder", "email"),
      logKey("u2", "e", "event_reminder", "push"),
    ]);
    const second = planReminders(input({ ...base, sent }));
    expect(second.deliveries.map((d) => [d.userId, d.channels])).toEqual([["u2", ["email"]]]);
    expect(second.skipped).toBe(1);
  });
});

describe("planReminders: deadline reminders", () => {
  const closing = (id: string, deadlineIn: number, extra: Partial<PlanEvent> = {}) =>
    ev(id, 24 * 7, { registration_deadline: at(deadlineIn), ...extra });

  it("reminds savers who haven't registered when the deadline is within 48h", () => {
    const { deliveries } = planReminders(input({
      events: [closing("d1", 20), closing("d2", 47), closing("d3", 60), closing("gone", -2)],
      marks: [mark("d1", "u1"), mark("d2", "u1"), mark("d3", "u1"), mark("gone", "u1")],
    }));
    expect(deliveries.map(keyOf).sort()).toEqual(["u1/d1/deadline_reminder", "u1/d2/deadline_reminder"]);
  });

  it("skips anyone already registered (any status) or registered externally", () => {
    const { deliveries } = planReminders(input({
      events: [closing("d", 20)],
      registrations: [reg("d", "u1", "going"), reg("d", "u2", "cancelled")],
      marks: [mark("d", "u1"), mark("d", "u2"), mark("d", "u3"), mark("d", "u3", "external_registered"), mark("d", "u4")],
    }));
    expect(deliveries.map((d) => d.userId)).toEqual(["u4"]);
  });

  it("respects the deadline_reminders preference and info-only events", () => {
    const prefs = new Map<string, Preferences>([["u1", { ...DEFAULT_PREFERENCES, deadline_reminders: false }]]);
    const { deliveries } = planReminders(input({
      events: [closing("d", 20), closing("info", 20, { registration_mode: "none" })],
      marks: [mark("d", "u1"), mark("d", "u2"), mark("info", "u2")],
      preferences: prefs,
    }));
    expect(deliveries.map(keyOf)).toEqual(["u2/d/deadline_reminder"]);
  });

  it("can send both a deadline and an event reminder for the same saved event", () => {
    const { deliveries } = planReminders(input({
      events: [ev("both", 20, { registration_deadline: at(6) })],
      marks: [mark("both", "u1")],
    }));
    expect(deliveries.map((d) => d.kind).sort()).toEqual(["deadline_reminder", "event_reminder"]);
  });
});

describe("channelsFor", () => {
  it("needs the preference, a device/address and server support", () => {
    const push = new Set(["a"]);
    const email = new Set(["a"]);
    expect(channelsFor("a", DEFAULT_PREFERENCES, push, email)).toEqual(["push", "email"]);
    expect(channelsFor("b", DEFAULT_PREFERENCES, push, email)).toEqual([]);
    expect(channelsFor("a", DEFAULT_PREFERENCES, push, email, { push: false, email: true })).toEqual(["email"]);
  });
});

describe("eventChangeRecipients", () => {
  it("includes active registrations and savers, not cancelled/declined people", () => {
    const out = eventChangeRecipients(
      [reg("e", "going", "going"), reg("e", "pend", "pending"), reg("e", "wait", "waitlisted"),
        reg("e", "pay", "awaiting_payment"), reg("e", "gone", "cancelled"), reg("e", "no", "declined")],
      [mark("e", "saver"), mark("e", "gone"), mark("e", "going"), mark("e", "ext", "external_registered"),
        mark("e", "nah", "dismissed")],
    );
    expect([...out.keys()].sort()).toEqual(["ext", "going", "pay", "pend", "saver", "wait"]);
    expect(out.get("going")).toBe("r-e-going");
    expect(out.get("saver")).toBeNull();
  });
});

describe("eventChangeFingerprint", () => {
  it("changes when time or place changes, not otherwise", () => {
    const a = { starts_at: "2026-10-20T18:00:00Z", ends_at: null, venue_name: "LT1", address: "SW7", format: "in_person" };
    expect(eventChangeFingerprint(a)).toBe(eventChangeFingerprint({ ...a }));
    expect(eventChangeFingerprint(a)).not.toBe(eventChangeFingerprint({ ...a, starts_at: "2026-10-20T19:00:00Z" }));
    expect(eventChangeFingerprint(a)).not.toBe(eventChangeFingerprint({ ...a, venue_name: "LT2" }));
  });
});

describe("classifyRegistration", () => {
  const t0 = "2026-10-16T08:00:00Z";
  const later = "2026-10-16T12:00:00Z";
  const r = (status: string, extra: Partial<{ decided_at: string | null; payment_status: string; updated_at: string }> = {}) => ({
    status, decided_at: null, payment_status: "none", created_at: t0, updated_at: t0, ...extra,
  });

  it("maps each status change to what we tell the attendee", () => {
    expect(classifyRegistration(r("going", { decided_at: later }))).toBe("approved");
    expect(classifyRegistration(r("going", { updated_at: later }))).toBe("off_waitlist");
    expect(classifyRegistration(r("going"))).toBe("confirmed");
    expect(classifyRegistration(r("going", { payment_status: "paid", updated_at: later }))).toBe("paid");
    expect(classifyRegistration(r("awaiting_payment", { decided_at: later }))).toBe("approved");
    expect(classifyRegistration(r("awaiting_payment", { updated_at: later }))).toBe("off_waitlist");
    expect(classifyRegistration(r("awaiting_payment"))).toBe("awaiting_payment");
    expect(classifyRegistration(r("pending"))).toBe("pending_review");
    expect(classifyRegistration(r("declined", { decided_at: later }))).toBe("declined");
    expect(classifyRegistration(r("waitlisted"))).toBeNull();
    expect(classifyRegistration(r("cancelled"))).toBeNull();
  });
});
