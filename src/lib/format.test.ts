import { describe, expect, it } from "vitest";
import { formatDeadline, formatPrice } from "./format";

describe("formatPrice", () => {
  it("handles free, single and ranges", () => {
    expect(formatPrice(0, 0)).toBe("Free");
    expect(formatPrice(5, 5)).toBe("£5");
    expect(formatPrice(5, 15)).toBe("£5 – £15");
    expect(formatPrice(0, 15)).toBe("Free – £15");
    expect(formatPrice(null, null)).toBeNull();
    expect(formatPrice(7.5, 7.5)).toBe("£7.50");
  });
});

describe("formatDeadline", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("describes time left", () => {
    expect(formatDeadline(null, now)).toBeNull();
    expect(formatDeadline("2026-10-16T11:00:00Z", now)).toBe("Registration closed");
    expect(formatDeadline("2026-10-16T18:00:00Z", now)).toBe("Closes in 6 hours");
    expect(formatDeadline("2026-10-19T12:00:00Z", now)).toBe("Closes in 3 days");
  });
});
