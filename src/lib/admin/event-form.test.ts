import { describe, expect, it } from "vitest";
import { adminEventSchema, fieldErrors, parseTags } from "./event-form";

const valid = {
  title: " Women in Tech Panel ",
  summary: "",
  description: "",
  starts_local: "2026-10-28T18:00",
  ends_local: "2026-10-28T20:00",
  format: "in_person",
  venue_name: "LT1",
  address: "",
  city: "London",
  organiser_id: "",
  category_id: "",
  tags: "Tech, careers; tech",
  registration_mode: "external",
  external_url: "https://example.com/r",
  external_label: "",
  price_min: "0",
  price_max: "",
  source_url: "",
};

describe("parseTags", () => {
  it("splits on commas and semicolons, dedupes", () => {
    expect(parseTags("A, b; a ,, c")).toEqual(["a", "b", "c"]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("adminEventSchema", () => {
  it("converts UK time to UTC and fills defaults", () => {
    const r = adminEventSchema.parse(valid);
    expect(r.title).toBe("Women in Tech Panel");
    expect(r.starts_at).toBe("2026-10-28T18:00:00.000Z"); // GMT after 25 Oct
    expect(r.ends_at).toBe("2026-10-28T20:00:00.000Z");
    expect(r.organiser_id).toBeNull();
    expect(r.tags).toEqual(["tech", "careers"]);
    expect(r.external_label).toBe("Apply now");
    expect(r.price_min).toBe(0);
    expect(r.price_max).toBe(0);
    expect(r.summary).toBeNull();
  });

  it("drops the link for info-only events", () => {
    const r = adminEventSchema.parse({ ...valid, registration_mode: "none" });
    expect(r.external_url).toBeNull();
  });

  it("reports field errors", () => {
    const res = adminEventSchema.safeParse({
      ...valid, title: "x", ends_local: "2026-10-28T17:00", external_url: "", organiser_id: "nope", price_min: "9", price_max: "3",
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const errs = fieldErrors(res.error);
    expect(errs.title).toBeTruthy();
    expect(errs.organiser_id).toBe("Pick from the list");
  });

  it("checks cross-field rules", () => {
    const res = adminEventSchema.safeParse({ ...valid, ends_local: "2026-10-28T17:00", external_url: "", price_min: "9", price_max: "3" });
    expect(res.success).toBe(false);
    if (res.success) return;
    const errs = fieldErrors(res.error);
    expect(errs.ends_local).toBe("Ends before it starts");
    expect(errs.external_url).toBe("Add the registration link");
    expect(errs.price_max).toBe("Lower than the minimum");
  });
});
