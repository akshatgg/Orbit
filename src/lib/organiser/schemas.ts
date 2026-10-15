import { z } from "zod";
import { ORGANISER_KINDS } from "@/lib/taxonomy";
import { hasOptions, type EventForm } from "./event-form";
import { usesTickets } from "./registration";
import { isValidSlug } from "./slug";
import { londonLocalToUtcIso } from "./time";

// ─── Shared bits ──────────────────────────────────────────────────────────────

/** "example.com" → "https://example.com"; leaves http(s) URLs alone. */
export function normaliseUrl(value: string) {
  const v = value.trim();
  if (v === "") return "";
  return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
}

export function isHttpUrl(value: string) {
  try {
    const u = new URL(value);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`).default("");

const optionalUrl = (label: string) =>
  z
    .string()
    .default("")
    .transform(normaliseUrl)
    .refine((v) => v === "" || isHttpUrl(v), `${label} must be a valid web address`);

const ORG_KIND_VALUES = ORGANISER_KINDS.map((k) => k.value) as [string, ...string[]];

// ─── Organisers ───────────────────────────────────────────────────────────────

const organiserProfileFields = {
  name: z.string().trim().min(2, "Add your organiser's name").max(80, "Keep the name under 80 characters"),
  bio: optionalText(1000, "Bio"),
  website: optionalUrl("Website"),
  contact_email: z.string().trim().pipe(z.email("Enter a valid contact email")),
  logo_url: optionalUrl("Logo"),
};

export const organiserApplicationSchema = z.object({
  ...organiserProfileFields,
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine(isValidSlug, "Use 2–60 lowercase letters, numbers and single hyphens"),
  kind: z.enum(ORG_KIND_VALUES, "Choose what kind of organiser you are"),
  university: optionalText(100, "University"),
});

export const organiserProfileSchema = z.object({
  ...organiserProfileFields,
  university: optionalText(100, "University"),
});

export const teamMemberSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter their email address")),
  role: z.enum(["owner", "editor"]).default("editor"),
});

export type FieldErrors = Record<string, string>;

/** First message per top-level field, for showing under inputs. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export const EDITOR_STEPS = [
  { id: "basics", label: "Basics" },
  { id: "when", label: "When & where" },
  { id: "registration", label: "Registration" },
  { id: "tickets", label: "Tickets & questions" },
  { id: "review", label: "Review" },
] as const;

export type StepId = (typeof EDITOR_STEPS)[number]["id"];

const FIELD_STEP: Record<string, StepId> = {
  title: "basics", summary: "basics", description: "basics", category_id: "basics", tags: "basics", cover_url: "basics",
  starts_at: "when", ends_at: "when", format: "when", venue_name: "when", address: "when", city: "when",
  online_url: "when", guest_info: "when",
  registration: "registration", external_url: "registration", external_label: "registration",
  display_price: "registration", capacity: "registration", waitlist_enabled: "registration",
  registration_deadline: "registration",
  tickets: "tickets", questions: "tickets",
};

export const stepForPath = (path: string) => FIELD_STEP[path.split(".")[0]] ?? "review";

const localTime = z.string().default("");
const decimal = /^\d+(\.\d{1,2})?$/;
const integer = /^\d+$/;

const ticketSchema = z.object({
  id: z.uuid().optional(),
  key: z.string(),
  name: z.string().trim().min(1, "Name this ticket").max(60, "Ticket names are 60 characters max"),
  price: z
    .string()
    .trim()
    .refine((v) => v === "" || (decimal.test(v) && Number(v) <= 10000), "Enter a price like 5 or 7.50"),
  quantity: z
    .string()
    .trim()
    .refine((v) => v === "" || (integer.test(v) && Number(v) >= 1 && Number(v) <= 100000), "Quantity must be a whole number above 0"),
  sales_end: localTime,
});

const questionSchema = z.object({
  id: z.uuid().optional(),
  key: z.string(),
  label: z.string().trim().min(1, "Write the question").max(200, "Questions are 200 characters max"),
  kind: z.enum(["short_text", "long_text", "single_select", "multi_select", "checkbox"]),
  options: z.array(z.string().trim().max(100, "Options are 100 characters max")).max(20, "Up to 20 options"),
  required: z.boolean(),
});

export const eventFormSchema = z.object({
  title: z.string().trim().min(3, "Give your event a title (3+ characters)").max(140, "Titles are 140 characters max"),
  summary: optionalText(200, "Summary"),
  description: optionalText(5000, "Description"),
  category_id: z.union([z.literal(""), z.uuid("Choose a category")]).default(""),
  tags: z.array(z.string().trim().min(1).max(30, "Tags are 30 characters max")).max(10, "Up to 10 tags"),
  cover_url: optionalUrl("Cover image"),
  starts_at: localTime,
  ends_at: localTime,
  format: z.enum(["in_person", "online", "hybrid"]),
  venue_name: optionalText(120, "Venue"),
  address: optionalText(200, "Address"),
  city: optionalText(60, "City"),
  online_url: optionalUrl("Online link"),
  guest_info: optionalText(1000, "Guest info"),
  registration: z.enum(["tickets", "application", "external", "none"]),
  external_url: optionalUrl("Registration link"),
  external_label: z.string().trim().max(40, "Button text is 40 characters max").default("Apply now"),
  display_price: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || (decimal.test(v) && Number(v) <= 10000), "Enter a price like 5 or 7.50"),
  capacity: z
    .string()
    .trim()
    .default("")
    .refine((v) => v === "" || (integer.test(v) && Number(v) >= 1 && Number(v) <= 100000), "Capacity must be a whole number above 0"),
  waitlist_enabled: z.boolean(),
  registration_deadline: localTime,
  tickets: z.array(ticketSchema).max(10, "Up to 10 ticket types"),
  questions: z.array(questionSchema).max(20, "Up to 20 questions"),
});

export type EventIntent = "draft" | "publish";

export type EventValidationContext = {
  intent: EventIntent;
  /** Organiser has a Stripe account that can take payments. */
  chargesEnabled: boolean;
  /** Start time already saved on the event, so an existing past event can still be edited. */
  originalStartsAt?: string | null;
  now?: Date;
};

/**
 * Full event validation. Drafts only need what the database needs (title, start time, a link for
 * external events); publishing also needs a venue, ticket types and payouts for paid tickets.
 */
export function eventSchema(ctx: EventValidationContext) {
  const now = (ctx.now ?? new Date()).getTime();
  const publishing = ctx.intent === "publish";

  return eventFormSchema.superRefine((f, c) => {
    const issue = (path: (string | number)[], message: string) => c.addIssue({ code: "custom", path, message });

    const start = londonLocalToUtcIso(f.starts_at);
    const end = f.ends_at ? londonLocalToUtcIso(f.ends_at) : null;
    const deadline = f.registration_deadline ? londonLocalToUtcIso(f.registration_deadline) : null;

    if (!start) issue(["starts_at"], "Choose when the event starts");
    if (f.ends_at && !end) issue(["ends_at"], "Enter a valid end time");
    if (start && end && new Date(end) <= new Date(start)) issue(["ends_at"], "The event must end after it starts");
    if (f.registration_deadline && !deadline) issue(["registration_deadline"], "Enter a valid deadline");
    if (deadline && start && new Date(deadline) > new Date(end ?? start)) {
      issue(["registration_deadline"], "The deadline must be before the event ends");
    }
    if (publishing && start && new Date(start).getTime() < now) {
      const unchanged = ctx.originalStartsAt && new Date(ctx.originalStartsAt).getTime() === new Date(start).getTime();
      if (!unchanged) issue(["starts_at"], "The start time is in the past");
    }

    if (f.registration === "external" && !f.external_url) {
      issue(["external_url"], "Paste the link where people register");
    }

    if (publishing && f.format !== "online" && !f.venue_name && !f.address) {
      issue(["venue_name"], "Add a venue so guests know where to go");
    }

    if (usesTickets(f.registration)) {
      if (publishing && f.tickets.length === 0) issue(["tickets"], "Add at least one ticket type");
      f.tickets.forEach((t, i) => {
        if (t.sales_end && !londonLocalToUtcIso(t.sales_end)) issue(["tickets", i, "sales_end"], "Enter a valid date");
        if (publishing && Number(t.price || 0) > 0 && !ctx.chargesEnabled) {
          issue(["tickets", i, "price"], "Connect payouts to sell paid tickets");
        }
        if (Number(t.price || 0) > 0 && Number(t.price) < 0.3) issue(["tickets", i, "price"], "Paid tickets must cost at least £0.30");
      });
      if (f.registration === "application" && publishing && f.questions.length === 0) {
        issue(["questions"], "Add at least one question for applicants");
      }
      f.questions.forEach((q, i) => {
        if (hasOptions(q.kind) && q.options.filter((o) => o.trim()).length < 2) {
          issue(["questions", i, "options"], "Add at least two options");
        }
      });
    }
  });
}

export type EventIssue = { path: string; message: string; step: StepId };

export function validateEventForm(form: EventForm, ctx: EventValidationContext):
  | { ok: true; data: EventForm }
  | { ok: false; issues: EventIssue[] } {
  const parsed = eventSchema(ctx).safeParse(form);
  if (parsed.success) return { ok: true, data: parsed.data as EventForm };
  return {
    ok: false,
    issues: parsed.error.issues.map((i) => {
      const path = i.path.map(String).join(".");
      return { path, message: i.message, step: stepForPath(path) };
    }),
  };
}
