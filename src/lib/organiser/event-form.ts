import type { EventFormat, QuestionKind } from "@/types/database";
import { fromDbRegistration, ticketPriceRange, toDbRegistration, usesTickets, type RegistrationChoice } from "./registration";
import { EVENT_TZ, londonLocalToUtcIso, utcIsoToLondonLocal } from "./time";

// The event editor works on plain strings (what inputs hold); these helpers convert to and
// from database rows. Validation lives in ./schemas.ts.

export type TicketDraft = {
  id?: string;
  key: string;
  name: string;
  price: string; // pounds, "" or "0" = free
  quantity: string; // "" = unlimited
  sales_end: string; // London datetime-local
};

export type QuestionDraft = {
  id?: string;
  key: string;
  label: string;
  kind: QuestionKind;
  options: string[];
  required: boolean;
};

export type EventForm = {
  title: string;
  summary: string;
  description: string;
  category_id: string;
  tags: string[];
  cover_url: string;
  starts_at: string; // London datetime-local
  ends_at: string;
  format: EventFormat;
  venue_name: string;
  address: string;
  city: string;
  online_url: string;
  guest_info: string;
  registration: RegistrationChoice;
  external_url: string;
  external_label: string;
  display_price: string; // external / info-only events: price shown on the card ("" = not shown)
  capacity: string;
  waitlist_enabled: boolean;
  registration_deadline: string;
  tickets: TicketDraft[];
  questions: QuestionDraft[];
};

export const QUESTION_KINDS: { value: QuestionKind; label: string }[] = [
  { value: "short_text", label: "Short answer" },
  { value: "long_text", label: "Paragraph" },
  { value: "single_select", label: "Pick one" },
  { value: "multi_select", label: "Pick any" },
  { value: "checkbox", label: "Tick box" },
];

export const hasOptions = (kind: QuestionKind) => kind === "single_select" || kind === "multi_select";

export const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export function newTicket(name = "General admission"): TicketDraft {
  return { key: newKey(), name, price: "0", quantity: "", sales_end: "" };
}

export function newQuestion(): QuestionDraft {
  return { key: newKey(), label: "", kind: "short_text", options: [], required: false };
}

export function emptyEventForm(): EventForm {
  return {
    title: "", summary: "", description: "", category_id: "", tags: [], cover_url: "",
    starts_at: "", ends_at: "", format: "in_person", venue_name: "", address: "", city: "London",
    online_url: "", guest_info: "", registration: "tickets", external_url: "", external_label: "Apply now",
    display_price: "", capacity: "", waitlist_enabled: true, registration_deadline: "",
    tickets: [newTicket()], questions: [],
  };
}

const blank = (s: string) => (s.trim() === "" ? null : s.trim());
const num = (s: string) => (s.trim() === "" ? null : Number(s));
const money = (s: string) => Math.round((num(s) ?? 0) * 100) / 100;

/** Columns written to `events` (organiser_id and status are added by the caller). */
export function formToEventRow(f: EventForm) {
  const { registration_mode, requires_approval } = toDbRegistration(f.registration);
  const tickets = usesTickets(f.registration);
  const physical = f.format !== "online";
  const shown = num(f.display_price);
  const price = tickets
    ? ticketPriceRange(f.tickets.map((t) => money(t.price)))
    : { price_min: shown, price_max: shown };

  return {
    title: f.title.trim(),
    summary: blank(f.summary),
    description: blank(f.description),
    category_id: blank(f.category_id),
    tags: [...new Set(f.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))],
    cover_url: blank(f.cover_url),
    starts_at: londonLocalToUtcIso(f.starts_at)!,
    ends_at: londonLocalToUtcIso(f.ends_at),
    timezone: EVENT_TZ,
    format: f.format,
    venue_name: physical ? blank(f.venue_name) : null,
    address: physical ? blank(f.address) : null,
    city: physical ? blank(f.city) : null,
    registration_mode,
    requires_approval,
    external_url: f.registration === "external" ? blank(f.external_url) : null,
    external_label: blank(f.external_label) ?? "Apply now",
    capacity: tickets ? num(f.capacity) : null,
    waitlist_enabled: tickets ? f.waitlist_enabled : false,
    registration_deadline: f.registration === "none" ? null : londonLocalToUtcIso(f.registration_deadline),
    ...price,
  };
}

export type EventRow = ReturnType<typeof formToEventRow>;

/** Online link + guest info (event_private) — only kept for online / hybrid events. */
export function formToPrivateRow(f: EventForm) {
  const online = f.format !== "in_person";
  return { online_url: online ? blank(f.online_url) : null, guest_info: blank(f.guest_info) };
}

export function formToTicketRows(f: EventForm) {
  if (!usesTickets(f.registration)) return [];
  return f.tickets.map((t, i) => ({
    id: t.id,
    name: t.name.trim(),
    price: money(t.price),
    quantity: num(t.quantity),
    sales_end_at: londonLocalToUtcIso(t.sales_end),
    sort_order: i,
  }));
}

export function formToQuestionRows(f: EventForm) {
  if (!usesTickets(f.registration)) return [];
  return f.questions.map((q, i) => ({
    id: q.id,
    label: q.label.trim(),
    kind: q.kind,
    options: hasOptions(q.kind) ? q.options.map((o) => o.trim()).filter(Boolean) : [],
    required: q.required,
    sort_order: i,
  }));
}

export type DbEventForEdit = {
  title: string;
  summary: string | null;
  description: string | null;
  category_id: string | null;
  tags: string[] | null;
  cover_url: string | null;
  starts_at: string;
  ends_at: string | null;
  format: string;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  registration_mode: string;
  requires_approval: boolean;
  external_url: string | null;
  external_label: string | null;
  capacity: number | null;
  waitlist_enabled: boolean;
  registration_deadline: string | null;
  price_min: number | null;
};

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function eventToForm(
  e: DbEventForEdit,
  priv: { online_url: string | null; guest_info: string | null } | null,
  tickets: { id: string; name: string; price: number | string; quantity: number | null; sales_end_at: string | null }[],
  questions: { id: string; label: string; kind: string; options: string[] | null; required: boolean }[],
): EventForm {
  const registration = fromDbRegistration(e.registration_mode, e.requires_approval);
  return {
    title: e.title,
    summary: str(e.summary),
    description: str(e.description),
    category_id: str(e.category_id),
    tags: e.tags ?? [],
    cover_url: str(e.cover_url),
    starts_at: utcIsoToLondonLocal(e.starts_at),
    ends_at: utcIsoToLondonLocal(e.ends_at),
    format: (e.format as EventFormat) ?? "in_person",
    venue_name: str(e.venue_name),
    address: str(e.address),
    city: str(e.city),
    online_url: str(priv?.online_url),
    guest_info: str(priv?.guest_info),
    registration,
    external_url: str(e.external_url),
    external_label: e.external_label ?? "Apply now",
    display_price: usesTickets(registration) ? "" : str(e.price_min),
    capacity: str(e.capacity),
    waitlist_enabled: e.waitlist_enabled,
    registration_deadline: utcIsoToLondonLocal(e.registration_deadline),
    tickets: tickets.map((t) => ({
      id: t.id, key: t.id, name: t.name, price: String(Number(t.price)), quantity: str(t.quantity),
      sales_end: utcIsoToLondonLocal(t.sales_end_at),
    })),
    questions: questions.map((q) => ({
      id: q.id, key: q.id, label: q.label, kind: q.kind as QuestionKind, options: q.options ?? [], required: q.required,
    })),
  };
}

/** Did anything guests rely on (time, place, format) change? Then they get notified. */
export function logisticsChanged(
  before: Pick<EventRow, "starts_at" | "ends_at" | "venue_name" | "address"> & { format: string },
  after: Pick<EventRow, "starts_at" | "ends_at" | "venue_name" | "address"> & { format: string },
) {
  const t = (v: string | null) => (v ? new Date(v).getTime() : null);
  return (
    t(before.starts_at) !== t(after.starts_at) ||
    t(before.ends_at) !== t(after.ends_at) ||
    (before.venue_name ?? null) !== (after.venue_name ?? null) ||
    (before.address ?? null) !== (after.address ?? null) ||
    before.format !== after.format
  );
}
