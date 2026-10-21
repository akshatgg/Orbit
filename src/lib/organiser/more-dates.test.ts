import { describe, expect, it } from "vitest";
import { emptyEventForm, formForDate, type EventForm } from "./event-form";
import { validateEventForm } from "./schemas";

const NOW = new Date("2026-10-21T12:00:00Z");
const base = (over: Partial<EventForm> = {}): EventForm => ({
  ...emptyEventForm(),
  title: "Business Networking & Referral Meetup",
  starts_at: "2026-10-28T17:00",
  ends_at: "2026-10-28T18:00",
  venue_name: "Mohali Hub",
  registration_deadline: "2026-10-28T12:00",
  tickets: [{ id: "11111111-1111-4111-8111-111111111111", key: "t", name: "Free", price: "0", quantity: "50", sales_end: "2026-10-27T23:00" }],
  extra_dates: [
    { key: "a", starts_at: "2026-11-04T17:00", ends_at: "2026-11-04T18:00" },
    { key: "b", starts_at: "2026-11-11T17:00", ends_at: "2026-11-11T18:00" },
  ],
  ...over,
});
const ctx = { intent: "publish" as const, chargesEnabled: false, now: NOW };

describe("formForDate", () => {
  it("copies the event onto a later date, moving deadlines by the same days and dropping row ids", () => {
    const f = formForDate(base(), { key: "b", starts_at: "2026-11-11T17:00", ends_at: "2026-11-11T18:00" });
    expect(f).toMatchObject({
      title: "Business Networking & Referral Meetup",
      starts_at: "2026-11-11T17:00",
      ends_at: "2026-11-11T18:00",
      registration_deadline: "2026-11-11T12:00",
      extra_dates: [],
    });
    expect(f.tickets[0]).toMatchObject({ id: undefined, name: "Free", quantity: "50", sales_end: "2026-11-10T23:00" });
  });
});

describe("validateEventForm: more dates", () => {
  it("accepts valid future dates", () => {
    expect(validateEventForm(base(), ctx).ok).toBe(true);
  });

  it("flags a past date, an end before its start, and a repeated date — on the When step", () => {
    const r = validateEventForm(base({
      extra_dates: [
        { key: "a", starts_at: "2026-10-01T17:00", ends_at: "" },
        { key: "b", starts_at: "2026-11-04T17:00", ends_at: "2026-11-04T16:00" },
        { key: "c", starts_at: "2026-10-28T17:00", ends_at: "" },
      ],
    }), ctx);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.issues.map((i) => [i.path, i.message, i.step])).toEqual(expect.arrayContaining([
      ["extra_dates.0.starts_at", "This date is in the past", "when"],
      ["extra_dates.1.ends_at", "This date must end after it starts", "when"],
      ["extra_dates.2.starts_at", "This date is already in the list", "when"],
    ]));
  });

  it("lets a draft keep a past extra date (only publishing checks that)", () => {
    const r = validateEventForm(base({ extra_dates: [{ key: "a", starts_at: "2026-10-01T17:00", ends_at: "" }] }), { ...ctx, intent: "draft" });
    expect(r.ok).toBe(true);
  });
});
