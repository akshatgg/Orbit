// Admin "Add / edit event" form → events row. Pure, shared by the action and tests.
import { z } from "zod";
import { ukLocalToUtc } from "./time";

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const text = (max: number) =>
  z.preprocess((v) => (blank(v) ? null : String(v).trim()), z.string().max(max, `Keep it under ${max} characters`).nullable());
const uuidOrNull = z.preprocess((v) => (blank(v) ? null : String(v)), z.uuid("Pick from the list").nullable());
const money = z.preprocess(
  (v) => (blank(v) ? null : Number(String(v).replace(/^£/, ""))),
  z.number({ error: "Enter a number" }).min(0, "Can't be negative").max(100000).nullable(),
);
const url = z.preprocess(
  (v) => (blank(v) ? null : String(v).trim()),
  z.string().regex(/^https?:\/\/\S+\.\S+/i, "Must start with http:// or https://").max(2000).nullable(),
);

/** Splits "finance, networking; careers" into unique lower-case tags. */
export function parseTags(raw: unknown) {
  if (blank(raw)) return [];
  return [...new Set(String(raw).split(/[;,]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

export const adminEventSchema = z
  .object({
    title: z.preprocess((v) => String(v ?? "").trim(), z.string().min(3, "At least 3 characters").max(140)),
    summary: text(200),
    description: text(10000),
    starts_local: z.string({ error: "Required" }).min(1, "Required"),
    ends_local: z.preprocess((v) => (blank(v) ? null : String(v)), z.string().nullable()),
    format: z.enum(["in_person", "online", "hybrid"]),
    venue_name: text(200),
    address: text(300),
    city: text(100),
    organiser_id: uuidOrNull,
    category_id: uuidOrNull,
    tags: z.preprocess(parseTags, z.array(z.string().max(40))),
    registration_mode: z.enum(["external", "none"], { error: "Pick how people register" }),
    external_url: url,
    external_label: text(40),
    price_min: money,
    price_max: money,
    source_url: url,
  })
  .transform((v, ctx) => {
    const starts = ukLocalToUtc(v.starts_local);
    if (!starts) ctx.addIssue({ code: "custom", path: ["starts_local"], message: "Pick a valid date and time" });
    const ends = v.ends_local ? ukLocalToUtc(v.ends_local) : null;
    if (v.ends_local && !ends) ctx.addIssue({ code: "custom", path: ["ends_local"], message: "Pick a valid date and time" });
    if (starts && ends && ends < starts) ctx.addIssue({ code: "custom", path: ["ends_local"], message: "Ends before it starts" });
    if (v.registration_mode === "external" && !v.external_url) {
      ctx.addIssue({ code: "custom", path: ["external_url"], message: "Add the registration link" });
    }
    if (v.price_min !== null && v.price_max !== null && v.price_max < v.price_min) {
      ctx.addIssue({ code: "custom", path: ["price_max"], message: "Lower than the minimum" });
    }
    return {
      title: v.title,
      summary: v.summary,
      description: v.description,
      starts_at: starts?.toISOString() ?? "",
      ends_at: ends?.toISOString() ?? null,
      format: v.format,
      venue_name: v.venue_name,
      address: v.address,
      city: v.city,
      organiser_id: v.organiser_id,
      category_id: v.category_id,
      tags: v.tags,
      registration_mode: v.registration_mode,
      external_url: v.registration_mode === "external" ? v.external_url : null,
      external_label: v.external_label ?? "Apply now",
      price_min: v.price_min ?? v.price_max,
      price_max: v.price_max ?? v.price_min,
      source_url: v.source_url,
    };
  });

export type AdminEventInput = z.output<typeof adminEventSchema>;

export type FieldErrors = Partial<Record<string, string>>;

/** First error per field, keyed by form field name. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
