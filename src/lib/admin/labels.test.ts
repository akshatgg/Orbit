import { describe, expect, it } from "vitest";
import { sanitiseSearch, sourceLabel } from "./labels";

describe("sanitiseSearch", () => {
  it("strips characters that break PostgREST filters but keeps emails", () => {
    expect(sanitiseSearch("  ada@orbit.test ")).toBe("ada@orbit.test");
    expect(sanitiseSearch("a,b(c)%_*\"'\\d")).toBe("a b c d");
    expect(sanitiseSearch(undefined)).toBe("");
    expect(sanitiseSearch("x".repeat(200))).toHaveLength(80);
  });
});

describe("sourceLabel", () => {
  it("names known sources", () => {
    expect(sourceLabel("csv")).toBe("CSV");
    expect(sourceLabel("manual")).toBe("Admin");
    expect(sourceLabel("eventbrite")).toBe("eventbrite");
  });
});
