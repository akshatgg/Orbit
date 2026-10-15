import Papa from "papaparse";
import { describe, expect, it } from "vitest";
import {
  CSV_COLUMNS, csvTemplate, hash53, makeCsvRowSchema, normaliseHeader, pickColumns, stableEventId,
  summariseRows, validateCsvRows, type RawCsvRow,
} from "./csv";

const lookup = { organiserSlugs: ["pottery-society"], categorySlugs: ["networking", "workshop"] };

const base: RawCsvRow = {
  title: "  Case   Night ",
  starts_at: "2026-11-12 18:30",
  external_url: "https://example.com/r",
};

describe("csvTemplate", () => {
  it("has every column and parses back into one valid row", () => {
    const parsed = Papa.parse<Record<string, string>>(csvTemplate(), { header: true, skipEmptyLines: true });
    expect(parsed.meta.fields).toEqual([...CSV_COLUMNS]);
    const [result] = validateCsvRows(parsed.data.map(pickColumns), lookup);
    expect(result.ok).toBe(true);
  });
});

describe("headers", () => {
  it("normalises messy headers and drops unknown columns", () => {
    expect(normaliseHeader("﻿ Starts At ")).toBe("starts_at");
    expect(normaliseHeader("Organiser-Slug")).toBe("organiser_slug");
    expect(pickColumns({ " Title ": " Hi there ", Junk: "x" })).toEqual({ title: "Hi there" });
  });
});

describe("stableEventId", () => {
  it("ignores case and spacing in the title but not the start time", () => {
    const a = stableEventId("Case Night", "2026-11-12T18:30:00.000Z");
    expect(stableEventId("  case   NIGHT ", "2026-11-12T18:30:00Z")).toBe(a);
    expect(stableEventId("Case Night", "2026-11-13T18:30:00.000Z")).not.toBe(a);
    expect(a).toMatch(/^auto-[0-9a-z]+$/);
  });
  it("hash53 is deterministic", () => {
    expect(hash53("orbit")).toBe(hash53("orbit"));
    expect(hash53("orbit")).not.toBe(hash53("orbiT"));
  });
});

describe("row schema", () => {
  const schema = makeCsvRowSchema(lookup);

  it("normalises a minimal row", () => {
    const r = schema.parse(base);
    expect(r.title).toBe("Case Night");
    expect(r.starts_at).toBe("2026-11-12T18:30:00.000Z"); // GMT in November
    expect(r.format).toBe("in_person");
    expect(r.city).toBe("London");
    expect(r.registration_mode).toBe("external"); // inferred from the URL
    expect(r.external_label).toBe("Apply now");
    expect(r.source_event_id).toBe(stableEventId("Case Night", r.starts_at));
    expect(r.tags).toEqual([]);
  });

  it("parses tags, prices, formats and slugs", () => {
    const r = schema.parse({
      ...base, tags: "Finance; networking ;;finance", price_min: "£5", price_max: "", format: "In person",
      category_slug: "Networking", organiser_slug: "pottery-society", registration_mode: "none",
    });
    expect(r.tags).toEqual(["finance", "networking"]);
    expect(r.price_min).toBe(5);
    expect(r.price_max).toBe(5);
    expect(r.format).toBe("in_person");
    expect(r.category_slug).toBe("networking");
    expect(r.registration_mode).toBe("none");
    expect(r.external_url).toBeNull();
  });

  it("treats 'free' as 0 and online events have no default city", () => {
    const r = schema.parse({ ...base, price_min: "free", format: "online" });
    expect(r.price_min).toBe(0);
    expect(r.city).toBeNull();
  });
});

describe("validateCsvRows", () => {
  it("reports readable per-column errors", () => {
    const [bad] = validateCsvRows(
      [{ title: "x", starts_at: "soon", format: "boat", category_slug: "nope", registration_mode: "external", price_min: "abc" }],
      lookup,
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    const text = bad.errors.join(" | ");
    expect(text).toContain("title: At least 3 characters");
    expect(text).toContain("starts_at:");
    expect(text).toContain("format:");
    expect(text).toContain("category_slug: No category with this slug");
    expect(text).toContain("price_min:");
  });

  it("checks cross-field rules", () => {
    const [r] = validateCsvRows(
      [{ title: "Case Night", starts_at: "2026-11-12 18:30", ends_at: "2026-11-12 17:00", registration_mode: "external", price_min: "10", price_max: "5" }],
      lookup,
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors).toEqual(expect.arrayContaining([
      "ends_at: Ends before it starts",
      "external_url: Required when registration_mode is external",
      "price_max: Lower than price_min",
    ]));
  });

  it("flags duplicates and counts rows with spreadsheet line numbers", () => {
    const results = validateCsvRows([base, { ...base, title: "case night" }, { title: "" }], lookup);
    expect(results.map((r) => r.line)).toEqual([2, 3, 4]);
    expect(results[1].ok).toBe(false);
    if (!results[1].ok) expect(results[1].errors[0]).toContain("Duplicate of row 2");
    expect(summariseRows(results)).toEqual({ total: 3, valid: 1, invalid: 2 });
  });

  it("keeps an explicit source_event_id", () => {
    const [r] = validateCsvRows([{ ...base, source_event_id: "abc-1" }], lookup);
    expect(r.ok && r.data.source_event_id).toBe("abc-1");
  });
});
