import { describe, expect, it } from "vitest";
import { THEME_COLORS, THEME_SCRIPT, msUntilNextSwitch, parsePreference, resolveTheme, toggledPreference } from "./theme";

describe("resolveTheme", () => {
  it("is automatic by time of day: light from 7:00, dark from 19:00", () => {
    expect(resolveTheme("system", 6)).toBe("dark");
    expect(resolveTheme("system", 7)).toBe("light");
    expect(resolveTheme("system", 13)).toBe("light");
    expect(resolveTheme("system", 18)).toBe("light");
    expect(resolveTheme("system", 19)).toBe("dark");
    expect(resolveTheme("system", 0)).toBe("dark");
  });
  it("lets an explicit choice win at any hour", () => {
    expect(resolveTheme("light", 23)).toBe("light");
    expect(resolveTheme("dark", 12)).toBe("dark");
  });
});

describe("msUntilNextSwitch", () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 22, h, m, 0, 0);
  it("counts to 7:00 in the early morning, 19:00 in the day, and 7:00 tomorrow at night", () => {
    expect(msUntilNextSwitch(at(5, 30))).toBe(90 * 60_000);
    expect(msUntilNextSwitch(at(18, 59))).toBe(60_000);
    expect(msUntilNextSwitch(at(22))).toBe(9 * 3_600_000);
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
  it("paints by time of day when nothing is chosen", () => {
    const run = (hour: number, stored: string | null) => {
      const attrs: Record<string, string> = {};
      const doc = {
        documentElement: { getAttribute: (k: string) => attrs[k] ?? null, setAttribute: (k: string, v: string) => { attrs[k] = v; }, style: {} },
        querySelectorAll: () => [],
        addEventListener: () => {},
        hidden: false,
      };
      const RealDate = Date;
      class FakeDate extends RealDate {
        constructor(...args: number[]) {
          super(...((args.length ? args : [2026, 9, 22, hour, 0, 0]) as [number, number, number, number, number, number]));
        }
      }
      const win = { dispatchEvent: () => true } as unknown as Record<string, unknown>;
      new Function("window", "document", "localStorage", "Date", "setTimeout", "clearTimeout", "Event", THEME_SCRIPT)(
        win, doc, { getItem: () => stored, setItem: () => {} }, FakeDate, () => 0, () => {}, class {},
      );
      return attrs["data-theme"];
    };
    expect(run(9, null)).toBe("light");
    expect(run(21, null)).toBe("dark");
    expect(run(21, "system")).toBe("dark");
    expect(run(9, "dark")).toBe("dark");
    expect(run(21, "light")).toBe("light");
  });

  it("is valid JavaScript that mentions the storage key and both colours", () => {
    expect(() => new Function(THEME_SCRIPT)).not.toThrow();
    expect(THEME_SCRIPT).toContain("orbit-theme");
    expect(THEME_SCRIPT).toContain(THEME_COLORS.dark);
    expect(THEME_SCRIPT).toContain(THEME_COLORS.light);
  });
});
