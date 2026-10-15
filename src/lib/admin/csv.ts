// CSV event import: template, row schema and normalisation.
// Pure — used in the browser (preview) and again on the server (import).
import { z } from "zod";
import { parseFlexibleDate } from "./time";

export const CSV_COLUMNS = [
  "title", "summary", "description", "starts_at", "ends_at", "format", "venue_name", "address", "city",
  "organiser_slug", "category_slug", "tags", "registration_mode", "external_url", "external_label",
  "price_min", "price_max", "source_url", "source_event_id",
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type RawCsvRow = Partial<Record<CsvColumn, string>>;

export const MAX_IMPORT_ROWS = 500;

const EXAMPLE_ROW: Record<CsvColumn, string> = {
  title: "Consulting Networking Evening",
  summary: "Meet consultants from three firms over drinks.",
  description: "Short talks followed by open networking. Bring your CV.",
  starts_at: "2026-11-12 18:30",
  ends_at: "2026-11-12 21:00",
  format: "in_person",
  venue_name: "Business School, Room 220",
  address: "Exhibition Road, London SW7 2AZ",
  city: "London",
  organiser_slug: "",
  category_slug: "networking",
  tags: "consulting;networking",
  registration_mode: "external",
  external_url: "https://example.com/register",
  external_label: "Register",
  price_min: "0",
  price_max: "0",
  source_url: "https://example.com/event",
  source_event_id: "",
};

function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Header row + one example row, ready to download. */
export function csvTemplate() {
  return [CSV_COLUMNS.join(","), CSV_COLUMNS.map((c) => csvCell(EXAMPLE_ROW[c])).join(",")].join("\r\n") + "\r\n";
}

/** "Starts At " → "starts_at". */
export function normaliseHeader(header: string) {
  return header.replace(/^﻿/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Keeps only known columns, trims every value. */
export function pickColumns(row: Record<string, unknown>): RawCsvRow {
  const out: RawCsvRow = {};
  for (const [key, value] of Object.entries(row)) {
    const col = normaliseHeader(key) as CsvColumn;
    if ((CSV_COLUMNS as readonly string[]).includes(col)) out[col] = String(value ?? "").trim();
  }
  return out;
}

/** cyrb53 — small, fast, stable 53-bit string hash (same result in every runtime). */
export function hash53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Stable id for rows without a source_event_id, so re-importing the same sheet updates
 * instead of duplicating. Case/whitespace in the title don't matter; the start instant does.
 */
export function stableEventId(title: string, startsAtIso: string) {
  const key = `${title.trim().toLowerCase().replace(/\s+/g, " ")}|${new Date(startsAtIso).toISOString()}`;
  return `auto-${hash53(key).toString(36)}`;
}

const blank = (v: unknown) => (typeof v === "string" && v.trim() === "") || v === undefined || v === null;
const optionalText = (max: number) =>
  z.preprocess((v) => (blank(v) ? null : String(v).trim()), z.string().max(max, `Keep it under ${max} characters`).nullable());

const httpUrl = z.preprocess(
  (v) => (blank(v) ? null : String(v).trim()),
  z.string().regex(/^https?:\/\/\S+\.\S+/i, "Must be a full link starting with http:// or https://").max(2000).nullable(),
);

const price = z.preprocess(
  (v) => {
    if (blank(v)) return null;
    const s = String(v).trim().toLowerCase();
    if (s === "free") return 0;
    const n = Number(s.replace(/^£/, "").replace(/,/g, ""));
    return Number.isFinite(n) ? n : s;
  },
  z.number({ error: "Must be a number like 0, 5 or 12.50" }).min(0, "Can't be negative").max(100000).nullable(),
);

const date = (required: boolean) =>
  z.preprocess(
    (v) => (blank(v) ? null : String(v)),
    z.string().nullable().transform((v, ctx) => {
      if (v === null) {
        if (required) ctx.addIssue({ code: "custom", message: "Required" });
        return null;
      }
      const d = parseFlexibleDate(v);
      if (!d) {
        ctx.addIssue({ code: "custom", message: `"${v}" isn't a date. Use 2026-11-12 18:30 (UK time) or ISO` });
        return null;
      }
      return d.toISOString();
    }),
  );

const FORMAT_ALIASES: Record<string, "in_person" | "online" | "hybrid"> = {
  in_person: "in_person", "in person": "in_person", "in-person": "in_person", inperson: "in_person",
  online: "online", virtual: "online", hybrid: "hybrid",
};

export type CsvLookup = { organiserSlugs: Iterable<string>; categorySlugs: Iterable<string> };

export type NormalisedCsvEvent = {
  title: string;
  summary: string | null;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  format: "in_person" | "online" | "hybrid";
  venue_name: string | null;
  address: string | null;
  city: string | null;
  organiser_slug: string | null;
  category_slug: string | null;
  tags: string[];
  registration_mode: "external" | "none";
  external_url: string | null;
  external_label: string;
  price_min: number | null;
  price_max: number | null;
  source_url: string | null;
  source_event_id: string;
};

/** Zod schema for one CSV row. Slugs are checked against what exists in ORBIT. */
export function makeCsvRowSchema(lookup: CsvLookup) {
  const organisers = new Set(lookup.organiserSlugs);
  const categories = new Set(lookup.categorySlugs);

  return z
    .object({
      title: z.preprocess(
        (v) => (blank(v) ? "" : String(v).trim().replace(/\s+/g, " ")),
        z.string().min(1, "Required").min(3, "At least 3 characters").max(140, "Keep it under 140 characters"),
      ),
      summary: optionalText(200),
      description: optionalText(10000),
      starts_at: date(true),
      ends_at: date(false),
      format: z.preprocess(
        (v) => (blank(v) ? "in_person" : FORMAT_ALIASES[String(v).trim().toLowerCase()] ?? String(v)),
        z.enum(["in_person", "online", "hybrid"], { error: "Use in_person, online or hybrid" }),
      ),
      venue_name: optionalText(200),
      address: optionalText(300),
      city: optionalText(100),
      organiser_slug: z.preprocess(
        (v) => (blank(v) ? null : String(v).trim().toLowerCase()),
        z.string().nullable().refine((s) => s === null || organisers.has(s), "No organiser with this slug"),
      ),
      category_slug: z.preprocess(
        (v) => (blank(v) ? null : String(v).trim().toLowerCase()),
        z.string().nullable().refine((s) => s === null || categories.has(s), "No category with this slug"),
      ),
      tags: z.preprocess(
        (v) =>
          blank(v)
            ? []
            : [...new Set(String(v).split(";").map((t) => t.trim().toLowerCase()).filter(Boolean))],
        z.array(z.string().max(40, "Tags must be under 40 characters")).max(20, "At most 20 tags"),
      ),
      registration_mode: z.preprocess(
        (v) => (blank(v) ? null : String(v).trim().toLowerCase()),
        z.enum(["external", "none"], { error: "Use external or none" }).nullable(),
      ),
      external_url: httpUrl,
      external_label: optionalText(40),
      price_min: price,
      price_max: price,
      source_url: httpUrl,
      source_event_id: optionalText(200),
    })
    .superRefine((row, ctx) => {
      if (row.starts_at && row.ends_at && row.ends_at < row.starts_at) {
        ctx.addIssue({ code: "custom", path: ["ends_at"], message: "Ends before it starts" });
      }
      if (row.registration_mode === "external" && !row.external_url) {
        ctx.addIssue({ code: "custom", path: ["external_url"], message: "Required when registration_mode is external" });
      }
      if (row.price_min !== null && row.price_max !== null && row.price_max < row.price_min) {
        ctx.addIssue({ code: "custom", path: ["price_max"], message: "Lower than price_min" });
      }
    })
    .transform((row): NormalisedCsvEvent => {
      const mode = row.registration_mode ?? (row.external_url ? "external" : "none");
      const startsAt = row.starts_at as string;
      return {
        title: row.title,
        summary: row.summary,
        description: row.description,
        starts_at: startsAt,
        ends_at: row.ends_at,
        format: row.format,
        venue_name: row.venue_name,
        address: row.address,
        city: row.city ?? (row.format === "online" ? null : "London"),
        organiser_slug: row.organiser_slug,
        category_slug: row.category_slug,
        tags: row.tags,
        registration_mode: mode,
        external_url: mode === "external" ? row.external_url : null,
        external_label: row.external_label ?? "Apply now",
        price_min: row.price_min ?? row.price_max,
        price_max: row.price_max ?? row.price_min,
        source_url: row.source_url,
        source_event_id: row.source_event_id ?? stableEventId(row.title, startsAt),
      };
    });
}

export type CsvRowResult =
  | { line: number; ok: true; data: NormalisedCsvEvent; raw: RawCsvRow }
  | { line: number; ok: false; errors: string[]; raw: RawCsvRow };

/**
 * Validates every row. `line` is the spreadsheet row number (header = line 1).
 * Rows that repeat an earlier row's source_event_id are flagged as duplicates.
 */
export function validateCsvRows(rows: RawCsvRow[], lookup: CsvLookup): CsvRowResult[] {
  const schema = makeCsvRowSchema(lookup);
  const seen = new Map<string, number>();
  return rows.map((raw, i) => {
    const line = i + 2;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((issue) => {
        const col = issue.path.join(".");
        return col ? `${col}: ${issue.message}` : issue.message;
      });
      return { line, ok: false, errors, raw };
    }
    const first = seen.get(parsed.data.source_event_id);
    if (first !== undefined) {
      return { line, ok: false, errors: [`Duplicate of row ${first} (same event)`], raw };
    }
    seen.set(parsed.data.source_event_id, line);
    return { line, ok: true, data: parsed.data, raw };
  });
}

export function summariseRows(results: CsvRowResult[]) {
  const valid = results.filter((r) => r.ok).length;
  return { total: results.length, valid, invalid: results.length - valid };
}
