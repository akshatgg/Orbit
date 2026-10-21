// Pure rules for the event page and tickets: which action to offer, labels, answer validation.
// No I/O here — everything is unit-tested in logic.test.ts.

import type { EventQuestion, RegistrationStatus } from "@/types/database";

/** Registrations that still hold (or wait for) a place. */
export const ACTIVE_STATUSES: RegistrationStatus[] = ["going", "pending", "waitlisted", "awaiting_payment"];

export function isActiveStatus(status: string | null | undefined): status is RegistrationStatus {
  return !!status && (ACTIVE_STATUSES as string[]).includes(status);
}

/** An event has ended once its end (or start, when there's no end) is in the past. */
export function hasEnded(event: { starts_at: string; ends_at: string | null }, now = new Date()) {
  return new Date(event.ends_at ?? event.starts_at).getTime() < now.getTime();
}

const money = (n: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: n % 1 ? 2 : 0 }).format(n);

/** "Free" or "£15". */
export function formatTicketPrice(price: number, currency = "GBP") {
  return price > 0 ? money(price, currency) : "Free";
}

// ─── Ticket types ──────────────────────────────────────────────────────────

export type TicketOption = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  /** Places left for this type (already capped by the event's capacity); null = unlimited. */
  remaining: number | null;
  sales_end_at: string | null;
};

export type TicketAvailability = "available" | "sold_out" | "sales_ended";

export function ticketAvailability(t: Pick<TicketOption, "remaining" | "sales_end_at">, now = new Date()): TicketAvailability {
  if (t.sales_end_at && new Date(t.sales_end_at).getTime() < now.getTime()) return "sales_ended";
  if (t.remaining !== null && t.remaining <= 0) return "sold_out";
  return "available";
}

/** The ticket type to pre-select: the first one on sale with room, else the first still on sale. */
export function defaultTicketId(tickets: TicketOption[], now = new Date()) {
  return (
    tickets.find((t) => ticketAvailability(t, now) === "available")?.id ??
    tickets.find((t) => ticketAvailability(t, now) !== "sales_ended")?.id ??
    null
  );
}

// ─── Call to action ────────────────────────────────────────────────────────

export type RegisterVariant = "free" | "approval" | "paid" | "waitlist";

/**
 * The button label for registering with a given ticket type. Mirrors register_for_event:
 * full → waitlist, then approval, then payment, otherwise a free ticket.
 */
export function registerVariant(opts: { requiresApproval: boolean; price: number; full: boolean }): RegisterVariant {
  if (opts.full) return "waitlist";
  if (opts.requiresApproval) return "approval";
  if (opts.price > 0) return "paid";
  return "free";
}

export function registerLabel(variant: RegisterVariant, price = 0, currency = "GBP") {
  switch (variant) {
    case "waitlist":
      return "Join waitlist";
    case "approval":
      return "Request to join";
    case "paid":
      return `Buy ticket · ${money(price, currency)}`;
    default:
      return "Get free ticket";
  }
}

export type CtaEvent = {
  status: string;
  registration_mode: string;
  requires_approval: boolean;
  waitlist_enabled: boolean;
  starts_at: string;
  ends_at: string | null;
  registration_deadline: string | null;
  external_url: string | null;
  external_label: string;
  currency: string;
};

export type CtaState =
  | { kind: "cancelled" }
  | { kind: "ended"; registrationStatus: RegistrationStatus | null }
  | { kind: "preview" }
  | { kind: "unavailable" }
  | { kind: "info" }
  | { kind: "external"; label: string }
  | { kind: "registered"; status: RegistrationStatus }
  | { kind: "declined" }
  | { kind: "closed" }
  | { kind: "sold_out" }
  | { kind: "register"; variant: RegisterVariant; label: string; needsSheet: boolean };

/** Decides what the sticky action bar on the event page offers. */
export function selectCta(input: {
  event: CtaEvent;
  registrationStatus: RegistrationStatus | null;
  tickets: TicketOption[];
  questionCount: number;
  now?: Date;
}): CtaState {
  const { event, registrationStatus, tickets, questionCount } = input;
  const now = input.now ?? new Date();
  const active = isActiveStatus(registrationStatus) ? registrationStatus : null;

  if (event.status === "cancelled") return { kind: "cancelled" };
  if (hasEnded(event, now)) return { kind: "ended", registrationStatus: active };
  if (event.status === "draft") return { kind: "preview" };
  if (event.status !== "published") return { kind: "unavailable" };

  if (event.registration_mode === "none") return { kind: "info" };
  if (event.registration_mode === "external") {
    return event.external_url ? { kind: "external", label: event.external_label || "Apply now" } : { kind: "info" };
  }

  if (active) return { kind: "registered", status: active };
  if (registrationStatus === "declined") return { kind: "declined" };
  if (event.registration_deadline && new Date(event.registration_deadline).getTime() < now.getTime()) {
    return { kind: "closed" };
  }

  const onSale = tickets.filter((t) => ticketAvailability(t, now) !== "sales_ended");
  if (onSale.length === 0) return { kind: "closed" };
  const withRoom = onSale.filter((t) => ticketAvailability(t, now) === "available");
  const full = withRoom.length === 0;
  if (full && !event.waitlist_enabled) return { kind: "sold_out" };

  const pick = withRoom[0] ?? onSale[0];
  const variant = registerVariant({ requiresApproval: event.requires_approval, price: pick.price, full });
  // Different prices across types → "Get tickets" and let the sheet decide.
  const mixedPrices = new Set(onSale.map((t) => t.price)).size > 1;
  const label = mixedPrices && variant === "paid" ? "Get tickets" : registerLabel(variant, pick.price, pick.currency);
  return { kind: "register", variant, label, needsSheet: onSale.length > 1 || questionCount > 0 };
}

// ─── Status copy ───────────────────────────────────────────────────────────

export const STATUS_COPY: Record<RegistrationStatus, { title: string; body: string }> = {
  going: { title: "You're going", body: "Show this QR code at the door to check in." },
  pending: {
    title: "Request sent",
    body: "The organiser will review it. We'll let you know when they decide — your QR ticket appears here once you're approved.",
  },
  waitlisted: {
    title: "You're on the waitlist",
    body: "The event is full right now. If a place opens up, you'll move off the waitlist automatically, oldest first.",
  },
  awaiting_payment: {
    title: "Complete payment",
    body: "Your place is held for 30 minutes. Pay to confirm your ticket.",
  },
  declined: { title: "Not accepted", body: "The organiser didn't accept your registration for this event." },
  cancelled: { title: "Cancelled", body: "You cancelled this registration." },
};

// ─── Answers ───────────────────────────────────────────────────────────────

export type Question = Pick<EventQuestion, "id" | "label" | "kind" | "options" | "required">;
export type AnswerValue = string | string[] | boolean;
export type Answers = Record<string, AnswerValue>;

const MAX_SHORT = 300;
const MAX_LONG = 4000;

/** Field name used for a question in the registration form. */
export const answerField = (questionId: string) => `q_${questionId}`;

/** Pulls raw answers for each question out of submitted form data. */
export function answersFromForm(questions: Question[], form: { get(name: string): unknown; getAll(name: string): unknown[] }) {
  const raw: Record<string, unknown> = {};
  for (const q of questions) {
    const name = answerField(q.id);
    raw[q.id] = q.kind === "multi_select" ? form.getAll(name) : form.get(name);
  }
  return raw;
}

/**
 * Cleans answers against the event's questions. Returns answers keyed by question id (only
 * answered ones) plus a message per invalid question. Unknown questions are dropped.
 */
export function validateAnswers(questions: Question[], raw: Record<string, unknown>) {
  const answers: Answers = {};
  const errors: Record<string, string> = {};

  for (const q of questions) {
    const value = raw[q.id];
    switch (q.kind) {
      case "checkbox": {
        const on = value === true || value === "on" || value === "true" || value === "yes";
        if (on) answers[q.id] = true;
        else if (q.required) errors[q.id] = "Please tick this box";
        break;
      }
      case "multi_select": {
        const list = (Array.isArray(value) ? value : value == null || value === "" ? [] : [value])
          .filter((v): v is string => typeof v === "string");
        const unique = [...new Set(list)];
        const picked = unique.filter((v) => q.options.includes(v));
        if (picked.length !== unique.length) errors[q.id] = "Choose from the options";
        else if (picked.length > 0) answers[q.id] = picked;
        else if (q.required) errors[q.id] = "Choose at least one option";
        break;
      }
      case "single_select": {
        const v = typeof value === "string" ? value : "";
        if (v && !q.options.includes(v)) errors[q.id] = "Choose one of the options";
        else if (v) answers[q.id] = v;
        else if (q.required) errors[q.id] = "Choose an option";
        break;
      }
      default: {
        const max = q.kind === "long_text" ? MAX_LONG : MAX_SHORT;
        const v = typeof value === "string" ? value.trim() : "";
        if (v.length > max) errors[q.id] = `Keep it under ${max} characters`;
        else if (v) answers[q.id] = v;
        else if (q.required) errors[q.id] = "This question is required";
      }
    }
  }
  return { answers, errors };
}

// ─── Errors ────────────────────────────────────────────────────────────────

// Messages raised by register_for_event / cancel_registration that are safe to show as-is.
const FRIENDLY = [
  "Sign in to register",
  "This event is not open for registration",
  "This event takes registrations on the organiser's own site",
  "This event has already ended",
  "Registration has closed",
  "Choose a valid ticket",
  "Sales for this ticket have ended",
  "Please answer: ",
  "The organiser didn't accept your registration",
  "This event is full",
  "You are not registered for this event",
];

export function friendlyError(message: string | null | undefined) {
  const m = (message ?? "").trim();
  if (FRIENDLY.some((f) => m.startsWith(f))) return m;
  return "Something went wrong. Please try again.";
}

// ─── Text & links ──────────────────────────────────────────────────────────

/** Returns the URL only when it's a well-formed http(s) link. */
export function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export type TextPart = { type: "text"; value: string } | { type: "link"; value: string; href: string };

export type InlinePart =
  | TextPart
  | { type: "bold"; children: InlinePart[] }
  | { type: "italic"; children: InlinePart[] };

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;

/** Bold/italic markers left by the source importer. */
const EMPHASIS_RE = /\*\*(?!\s)([\s\S]*?[^\s*])\*\*|\*(?!\s)([^*\n]*?[^\s*])\*/g;

/** Splits plain text into text and link parts. Only http(s) links; trailing punctuation stays text. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_RE)) {
    let raw = match[0];
    const start = match.index ?? 0;
    // Trim punctuation that usually ends a sentence rather than the URL.
    while (/[.,;:!?)\]]$/.test(raw)) {
      if (raw.endsWith(")") && (raw.match(/\(/g)?.length ?? 0) >= (raw.match(/\)/g)?.length ?? 0)) break;
      raw = raw.slice(0, -1);
    }
    const href = safeHttpUrl(raw.startsWith("www.") ? `https://${raw}` : raw);
    if (!href) continue;
    if (start > last) parts.push({ type: "text", value: text.slice(last, start) });
    parts.push({ type: "link", value: raw, href });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });
  return parts;
}

/** Plain text + links + safe bold/italic. Markers without a pair stay as plain text. */
export function inlineParts(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;

  for (const match of text.matchAll(EMPHASIS_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(...linkify(text.slice(last, start)));
    if (match[1] !== undefined) parts.push({ type: "bold", children: inlineParts(match[1]) });
    else parts.push({ type: "italic", children: inlineParts(match[2]) });
    last = start + match[0].length;
  }

  if (last < text.length) parts.push(...linkify(text.slice(last)));
  return parts;
}

/** Paragraphs separated by blank lines (single newlines stay inside a paragraph). */
export function paragraphs(text: string | null | undefined) {
  return (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Google Maps search link for a venue. */
export function mapsUrl(parts: (string | null | undefined)[]) {
  const query = parts.map((p) => p?.trim()).filter(Boolean).join(", ");
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

/** "a1b2 c3d4 …" — the ticket code in readable groups for manual check-in. */
export function formatTicketCode(code: string) {
  return code.toUpperCase().match(/.{1,4}/g)?.join(" ") ?? code;
}

// ─── My Tickets ────────────────────────────────────────────────────────────

/** Splits registrations into upcoming (soonest first) and past (most recent first). */
export function splitTickets<T extends { status: string; event: { starts_at: string; ends_at: string | null } }>(
  rows: T[],
  now = new Date(),
) {
  const shown = rows.filter((r) => r.status !== "cancelled" && r.status !== "declined");
  const upcoming = shown
    .filter((r) => !hasEnded(r.event, now))
    .sort((a, b) => +new Date(a.event.starts_at) - +new Date(b.event.starts_at));
  const past = shown
    .filter((r) => hasEnded(r.event, now))
    .sort((a, b) => +new Date(b.event.starts_at) - +new Date(a.event.starts_at));
  return { upcoming, past };
}
