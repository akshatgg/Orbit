import { describe, expect, it } from "vitest";
import {
  deadlineReminderMessage,
  eventChangedMessage,
  eventReminderMessage,
  registrationMessage,
  relativeDay,
  testMessage,
  type MessageEvent,
} from "./messages";
import { absoluteUrl, htmlToText, renderEmail } from "./templates";

const NOW = new Date("2026-10-16T08:00:00Z");
const event: MessageEvent = {
  id: "evt-1",
  title: "Case <Interview> Bootcamp",
  starts_at: "2026-10-17T17:00:00Z", // 18:00 UK time (BST)
  ends_at: "2026-10-17T19:00:00Z",
  format: "in_person",
  venue_name: "Business School, Room 220",
  address: "Exhibition Road",
  registration_deadline: "2026-10-16T20:00:00Z",
  registration_mode: "tickets",
  cancel_reason: "Speaker is ill",
};
const APP = "https://orbit.example.com/";

describe("relativeDay", () => {
  it("speaks in UK days", () => {
    expect(relativeDay("2026-10-16T22:30:00Z", NOW)).toBe("today"); // 23:30 BST, still the 16th
    expect(relativeDay("2026-10-16T23:30:00Z", NOW)).toBe("tomorrow"); // 00:30 BST on the 17th
    expect(relativeDay("2026-10-20T12:00:00Z", NOW)).toBe("on Tue 20 Oct");
  });
});

describe("messages", () => {
  it("event reminder for someone going opens their ticket", () => {
    const m = eventReminderMessage(event, "going", NOW);
    expect(m.title).toBe("Tomorrow at 18:00: Case <Interview> Bootcamp");
    expect(m.url).toBe("/tickets");
    expect(m.tag).toBe("reminder-evt-1");
    expect(m.actions?.map((a) => a.action)).toEqual(["ticket", "event"]);
    expect(m.email.cta.label).toBe("View your ticket");
  });

  it("saved / unpaid reminders link to the event", () => {
    expect(eventReminderMessage(event, "saved", NOW).url).toBe("/events/evt-1");
    expect(eventReminderMessage(event, "unpaid", NOW).email.cta.label).toBe("Complete payment");
  });

  it("deadline reminder says how long is left", () => {
    const m = deadlineReminderMessage(event, NOW);
    expect(m.title).toBe("Registration closes in 12 hours");
    expect(m.email.cta.label).toBe("Register now");
    const ext = deadlineReminderMessage({ ...event, registration_mode: "external", external_label: "Apply on Careers" }, NOW);
    expect(ext.email.cta.label).toBe("Apply on Careers");
  });

  it("cancellation includes the reason; update shows the new time and place", () => {
    const c = eventChangedMessage(event, "cancelled");
    expect(c.title).toBe("Cancelled: Case <Interview> Bootcamp");
    expect(c.body).toContain("Speaker is ill");
    const u = eventChangedMessage(event, "updated");
    expect(u.title).toBe("Event updated: Case <Interview> Bootcamp");
    expect(u.body).toBe("New time/place: Sat 17 Oct · 18:00 · Business School, Room 220, Exhibition Road");
  });

  it("registration updates", () => {
    expect(registrationMessage(event, "approved", "going").email.heading).toBe("You're in!");
    expect(registrationMessage(event, "approved", "going").email.cta).toEqual({ label: "View your ticket", url: "/tickets" });
    expect(registrationMessage(event, "off_waitlist", "going").email.heading).toContain("spot opened up");
    expect(registrationMessage(event, "approved", "awaiting_payment").email.cta.label).toBe("Complete payment");
    expect(registrationMessage(event, "declined", "declined").email.cta.url).toBe("/");
    expect(registrationMessage(event, "pending_review", "pending").title).toContain("Application received");
  });
});

describe("renderEmail", () => {
  const rendered = renderEmail(eventReminderMessage(event, "going", NOW), APP);

  it("renders a branded, escaped HTML email with an absolute CTA", () => {
    expect(rendered.subject).toBe("Reminder: Case <Interview> Bootcamp is tomorrow");
    expect(rendered.html).toContain("<!doctype html>");
    expect(rendered.html).toContain("ORBIT");
    expect(rendered.html).toContain("linear-gradient(135deg");
    expect(rendered.html).toContain('href="https://orbit.example.com/tickets"');
    expect(rendered.html).toContain("Case &lt;Interview&gt; Bootcamp");
    expect(rendered.html).not.toContain("<Interview>");
    expect(rendered.html).toContain('href="https://orbit.example.com/profile"'); // manage reminders
  });

  it("has a readable plain-text fallback", () => {
    expect(rendered.text).toContain("See you tomorrow!");
    expect(rendered.text).toContain("You're going to Case <Interview> Bootcamp.");
    expect(rendered.text).toContain("When: Saturday, 17 October 2026 · 18:00 – 20:00");
    expect(rendered.text).toContain("View your ticket: https://orbit.example.com/tickets");
    expect(rendered.text).not.toMatch(/<\/?b>/);
  });

  it("omits the details table when there are none", () => {
    const t = renderEmail(testMessage(), APP);
    expect(t.html).not.toContain("letter-spacing:0.12em;text-transform:uppercase");
  });

  it("helpers", () => {
    expect(absoluteUrl("/events/1", "http://localhost:3000/")).toBe("http://localhost:3000/events/1");
    expect(absoluteUrl("https://x.test/a", APP)).toBe("https://x.test/a");
    expect(htmlToText("<b>A</b> &amp; &ldquo;B&rdquo;")).toBe("A & “B”");
  });
});
