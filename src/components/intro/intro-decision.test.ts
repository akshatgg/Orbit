import { describe, expect, it } from "vitest";
import { shouldPlayIntro } from "./intro-decision";

const base = { search: "", userAgent: "Mozilla/5.0 (iPhone) Safari", webdriver: false, seen: false };

describe("shouldPlayIntro", () => {
  it("plays on the first visit of a session", () => {
    expect(shouldPlayIntro(base)).toBe(true);
  });
  it("does not replay once seen", () => {
    expect(shouldPlayIntro({ ...base, seen: true })).toBe(false);
  });
  it("?intro=0 never plays, ?intro=1 always plays", () => {
    expect(shouldPlayIntro({ ...base, search: "?intro=0" })).toBe(false);
    expect(shouldPlayIntro({ ...base, search: "?a=1&intro=1", seen: true })).toBe(true);
    expect(shouldPlayIntro({ ...base, search: "?intro=1", webdriver: true, userAgent: "Googlebot" })).toBe(true);
    expect(shouldPlayIntro({ ...base, search: "?intro=2" })).toBe(true);
  });
  it("skips crawlers and automation", () => {
    for (const ua of ["Googlebot/2.1", "Mozilla/5.0 (compatible; bingbot)", "Yahoo! Slurp", "Chrome-Lighthouse", "HeadlessChrome/120", "some Spider"]) {
      expect(shouldPlayIntro({ ...base, userAgent: ua })).toBe(false);
    }
    expect(shouldPlayIntro({ ...base, webdriver: true })).toBe(false);
  });
});

describe("INTRO_SCRIPT", () => {
  it("is plain parseable JavaScript with no leftover type syntax", async () => {
    const { INTRO_SCRIPT } = await import("./intro-script");
    expect(() => new Function(INTRO_SCRIPT)).not.toThrow();
    expect(INTRO_SCRIPT).toContain("orbit-intro-seen");
    expect(INTRO_SCRIPT).not.toMatch(/: (string|number|boolean|HTMLElement)\b/);
  });
});
