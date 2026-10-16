import { describe, expect, it } from "vitest";
import { THEME_COLORS, THEME_SCRIPT, parsePreference, resolveTheme, toggledPreference } from "./theme";

describe("resolveTheme", () => {
  it("follows the system only when the preference is system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("lets an explicit choice win over the system", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("parsePreference", () => {
  it("accepts the three known values and falls back to system", () => {
    expect(parsePreference("light")).toBe("light");
    expect(parsePreference("dark")).toBe("dark");
    expect(parsePreference("system")).toBe("system");
    expect(parsePreference("purple")).toBe("system");
    expect(parsePreference(null)).toBe("system");
  });
});

describe("toggledPreference", () => {
  it("flips the visible theme", () => {
    expect(toggledPreference("dark")).toBe("light");
    expect(toggledPreference("light")).toBe("dark");
  });
});

describe("THEME_SCRIPT", () => {
  it("is valid JavaScript that mentions the storage key and both colours", () => {
    expect(() => new Function(THEME_SCRIPT)).not.toThrow();
    expect(THEME_SCRIPT).toContain("orbit-theme");
    expect(THEME_SCRIPT).toContain(THEME_COLORS.dark);
    expect(THEME_SCRIPT).toContain(THEME_COLORS.light);
  });
});
