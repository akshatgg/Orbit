import { describe, expect, it } from "vitest";
import { formatEventLocation } from "./export";

describe("formatEventLocation", () => {
  it("joins venue parts without duplicates", () => {
    expect(formatEventLocation({ format: "in_person", venue_name: "Huxley 311", address: null, city: "London" })).toBe("Huxley 311, London");
    expect(formatEventLocation({ format: "in_person", venue_name: "London", address: null, city: "London" })).toBe("London");
  });
  it("handles online and unknown", () => {
    expect(formatEventLocation({ format: "online", venue_name: null, address: null, city: null })).toBe("Online");
    expect(formatEventLocation({ format: "in_person", venue_name: null, address: null, city: null })).toBeNull();
  });
});
