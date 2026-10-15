// Pure: turns "what happened" into the words of a push notification and an email.

import { formatEventDate, formatLongDate, formatTimeRange } from "@/lib/format";
import type { Audience, RegistrationUpdate } from "./plan";

export type MessageEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  format?: string | null;
  venue_name?: string | null;
  address?: string | null;
  registration_deadline?: string | null;
  registration_mode?: string | null;
  external_label?: string | null;
  cancel_reason?: string | null;
};

export type Detail = { label: string; value: string };

export type Message = {
  /** Push title + body (short). */
  title: string;
  body: string;
  /** App path the notification opens. */
  url: string;
  /** Collapses repeat notifications about the same thing on the device. */
  tag: string;
  actions?: { action: string; title: string; url: string }[];
  email: {
    subject: string;
    preheader: string;
    heading: string;
    paragraphs: string[];
    details: Detail[];
    cta: { label: string; url: string };
  };
};

const TZ = "Europe/London";
const ukDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TZ });

/** "today", "tomorrow" or "on Thu 16 Oct" in UK time. */
export function relativeDay(startsAt: string | Date, now: Date) {
  const day = (d: Date) => Date.parse(`${ukDay.format(d)}T00:00:00Z`);
  const diff = Math.round((day(new Date(startsAt)) - day(now)) / 864e5);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  return `on ${formatEventDate(startsAt).split(" · ")[0]}`;
}

function where(e: MessageEvent) {
  if (e.format === "online") return "Online";
  const place = [e.venue_name, e.address].filter(Boolean).join(", ");
  if (e.format === "hybrid") return place ? `${place} (or online)` : "Hybrid";
  return place || "Venue to be confirmed";
}

function whenDetail(e: MessageEvent): Detail {
  return { label: "When", value: `${formatLongDate(e.starts_at)} · ${formatTimeRange(e.starts_at, e.ends_at)}` };
}

function eventDetails(e: MessageEvent): Detail[] {
  return [whenDetail(e), { label: "Where", value: where(e) }];
}

const eventPath = (e: MessageEvent) => `/events/${e.id}`;
const TICKETS_PATH = "/tickets";

// ─── Reminders (cron) ───────────────────────────────────────────────────────

export function eventReminderMessage(e: MessageEvent, audience: Audience, now: Date): Message {
  const day = relativeDay(e.starts_at, now);
  const time = formatTimeRange(e.starts_at).trim();
  const when = `${day[0].toUpperCase()}${day.slice(1)} at ${time}`;
  const tag = `reminder-${e.id}`;

  if (audience === "going") {
    return {
      title: `${when}: ${e.title}`,
      body: `You're going. ${where(e)}. Have your ticket ready.`,
      url: TICKETS_PATH,
      tag,
      actions: [
        { action: "ticket", title: "My ticket", url: TICKETS_PATH },
        { action: "event", title: "Event details", url: eventPath(e) },
      ],
      email: {
        subject: `Reminder: ${e.title} is ${day}`,
        preheader: `${when} · ${where(e)}`,
        heading: `See you ${day}!`,
        paragraphs: [`You're going to <b>${esc(e.title)}</b>. Here are the details so you're all set.`],
        details: eventDetails(e),
        cta: { label: "View your ticket", url: TICKETS_PATH },
      },
    };
  }

  if (audience === "unpaid") {
    return {
      title: `${when}: ${e.title}`,
      body: "Your place isn't confirmed yet. Finish paying to secure it.",
      url: eventPath(e),
      tag,
      email: {
        subject: `Finish booking ${e.title} (${day})`,
        preheader: "Your place isn't confirmed until you pay.",
        heading: "Your ticket is waiting",
        paragraphs: [`<b>${esc(e.title)}</b> is ${day}. Complete your payment to lock in your place.`],
        details: eventDetails(e),
        cta: { label: "Complete payment", url: eventPath(e) },
      },
    };
  }

  const canRegister = e.registration_mode === "tickets" || e.registration_mode === "external";
  return {
    title: `${when}: ${e.title}`,
    body: canRegister ? `You saved this. ${where(e)}. Grab a spot if you're going.` : `You saved this. ${where(e)}.`,
    url: eventPath(e),
    tag,
    email: {
      subject: `${e.title} is ${day}`,
      preheader: `${when} · ${where(e)}`,
      heading: `Coming up ${day}`,
      paragraphs: [
        `You saved <b>${esc(e.title)}</b>.${canRegister ? " If you're going, make sure you've registered." : ""}`,
      ],
      details: eventDetails(e),
      cta: { label: canRegister ? "View event" : "See details", url: eventPath(e) },
    },
  };
}

export function deadlineReminderMessage(e: MessageEvent, now: Date): Message {
  const deadline = e.registration_deadline ?? e.starts_at;
  const hours = Math.max(1, Math.round((new Date(deadline).getTime() - now.getTime()) / 36e5));
  const closes = hours < 24 ? `in ${hours} hour${hours === 1 ? "" : "s"}` : relativeDay(deadline, now);
  const closesAt = `${formatEventDate(deadline)}`;
  const label = e.registration_mode === "external" ? (e.external_label || "Apply now") : "Register now";
  return {
    title: `Registration closes ${closes}`,
    body: `${e.title}: you saved this but haven't registered yet.`,
    url: eventPath(e),
    tag: `deadline-${e.id}`,
    actions: [{ action: "event", title: label, url: eventPath(e) }],
    email: {
      subject: `Last chance: registration for ${e.title} closes ${closes}`,
      preheader: `Closes ${closesAt}. Don't miss out.`,
      heading: "Don't miss the deadline",
      paragraphs: [
        `You saved <b>${esc(e.title)}</b> but haven't registered yet. Registration closes <b>${esc(closesAt)}</b>.`,
      ],
      details: [{ label: "Deadline", value: closesAt }, whenDetail(e)],
      cta: { label, url: eventPath(e) },
    },
  };
}

// ─── Event changed by the organiser ────────────────────────────────────────

export function eventChangedMessage(e: MessageEvent, change: "updated" | "cancelled"): Message {
  if (change === "cancelled") {
    const reason = e.cancel_reason?.trim();
    return {
      title: `Cancelled: ${e.title}`,
      body: reason ? `The organiser cancelled this event. "${reason}"` : "The organiser cancelled this event.",
      url: eventPath(e),
      tag: `event-${e.id}`,
      email: {
        subject: `Cancelled: ${e.title}`,
        preheader: `${e.title} on ${formatEventDate(e.starts_at)} won't go ahead.`,
        heading: "This event has been cancelled",
        paragraphs: [
          `Sorry, <b>${esc(e.title)}</b> on ${esc(formatEventDate(e.starts_at))} won't go ahead.`,
          ...(reason ? [`The organiser said: <i>&ldquo;${esc(reason)}&rdquo;</i>`] : []),
          "You don't need to do anything. If you paid, the organiser will be in touch about a refund.",
        ],
        details: [],
        cta: { label: "Find something else", url: "/" },
      },
    };
  }
  return {
    title: `Event updated: ${e.title}`,
    body: `New time/place: ${formatEventDate(e.starts_at)} · ${where(e)}`,
    url: eventPath(e),
    tag: `event-${e.id}`,
    email: {
      subject: `Updated: ${e.title} has a new time or place`,
      preheader: `Now ${formatEventDate(e.starts_at)} · ${where(e)}`,
      heading: "Heads up: details changed",
      paragraphs: [`The organiser updated <b>${esc(e.title)}</b>. Here's the latest:`],
      details: eventDetails(e),
      cta: { label: "View event", url: eventPath(e) },
    },
  };
}

// ─── Registration status changed ───────────────────────────────────────────

export function registrationMessage(e: MessageEvent, update: RegistrationUpdate, status: string): Message {
  const tag = `registration-${e.id}`;
  const date = formatEventDate(e.starts_at);
  const t = esc(e.title);

  const payment = (): Message => {
    const heading =
      update === "approved" ? "You've been accepted!" : update === "off_waitlist" ? "A spot opened up!" : "Complete your booking";
    return {
      title: update === "approved" ? `Accepted: ${e.title}` : update === "off_waitlist" ? `A spot opened up: ${e.title}` : `Complete your booking: ${e.title}`,
      body: "Pay now to secure your place.",
      url: eventPath(e),
      tag,
      email: {
        subject: `${heading} Complete payment for ${e.title}`,
        preheader: "Your place is held, pay to confirm it.",
        heading,
        paragraphs: [`Your place at <b>${t}</b> is waiting. Complete your payment to confirm it.`],
        details: eventDetails(e),
        cta: { label: "Complete payment", url: eventPath(e) },
      },
    };
  };

  if (status === "awaiting_payment") return payment();

  switch (update) {
    case "awaiting_payment":
      return payment();
    case "approved":
    case "off_waitlist":
    case "confirmed":
    case "paid": {
      const heading =
        update === "approved" ? "You're in!" : update === "off_waitlist" ? "A spot opened up. You're in!" : update === "paid" ? "Payment received. You're in!" : "You're going!";
      const why =
        update === "approved"
          ? `The organiser accepted you for <b>${t}</b>.`
          : update === "off_waitlist"
            ? `You've moved off the waitlist for <b>${t}</b>.`
            : `Your place at <b>${t}</b> is confirmed.`;
      return {
        title: `${heading} ${e.title}`,
        body: `${date}. Your ticket is ready in ORBIT.`,
        url: TICKETS_PATH,
        tag,
        actions: [{ action: "ticket", title: "View ticket", url: TICKETS_PATH }],
        email: {
          subject: `${heading} ${e.title}`,
          preheader: `${date} · your QR ticket is in ORBIT`,
          heading,
          paragraphs: [`${why} Show the QR code on your ticket at the door.`],
          details: eventDetails(e),
          cta: { label: "View your ticket", url: TICKETS_PATH },
        },
      };
    }
    case "pending_review":
      return {
        title: `Application received: ${e.title}`,
        body: "The organiser will review it. We'll let you know.",
        url: eventPath(e),
        tag,
        email: {
          subject: `Your application for ${e.title} is with the organiser`,
          preheader: "We'll tell you as soon as they decide.",
          heading: "You're in the queue",
          paragraphs: [`Your application for <b>${t}</b> is with the organiser. We'll let you know as soon as they decide.`],
          details: eventDetails(e),
          cta: { label: "View event", url: eventPath(e) },
        },
      };
    case "declined":
      return {
        title: `Update on ${e.title}`,
        body: "The organiser couldn't offer you a place this time.",
        url: "/",
        tag,
        email: {
          subject: `Update on your registration for ${e.title}`,
          preheader: "There are plenty more events to explore.",
          heading: "Not this time",
          paragraphs: [
            `Unfortunately the organiser couldn't offer you a place at <b>${t}</b>.`,
            "There's plenty more coming up. Here are events picked for you.",
          ],
          details: [],
          cta: { label: "Explore events", url: "/" },
        },
      };
  }
}

export function testMessage(): Message {
  return {
    title: "ORBIT notifications are on",
    body: "You'll hear from us before events you've saved or booked.",
    url: "/profile",
    tag: "orbit-test",
    email: {
      subject: "ORBIT notifications are on",
      preheader: "This is a test.",
      heading: "You're all set",
      paragraphs: ["This is a test notification from ORBIT."],
      details: [],
      cta: { label: "Open ORBIT", url: "/" },
    },
  };
}

/** Escapes text for HTML. Message paragraphs may contain <b>/<i> we add ourselves. */
export function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
