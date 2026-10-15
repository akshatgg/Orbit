import { describe, expect, it } from "vitest";
import {
  countSlots,
  formatDayRuns,
  normalizeAvailability,
  summariseAvailability,
  toggleSlot,
  withSlots,
} from "./availability";
import {
  draftFromProfile,
  draftErrors,
  keepKnownCategories,
  profilePrefsSchema,
  stepErrors,
  type ProfileDraft,
} from "./schema";
import { hasEnded } from "./events";

const draft = (patch: Partial<ProfileDraft> = {}): ProfileDraft => ({
  ...draftFromProfile({ full_name: "Sam Student" }),
  career_interests: ["consulting"],
  ...patch,
});

describe("availability", () => {
  it("normalises unknown days, parts, duplicates and order", () => {
    expect(
      normalizeAvailability({ tue: ["evening", "morning", "evening", "brunch"], fun: ["day"], wed: [], mon: "x" }),
    ).toEqual({ tue: ["morning", "evening"] });
    expect(normalizeAvailability(null)).toEqual({});
    expect(normalizeAvailability(["mon"])).toEqual({});
  });

  it("toggles a slot on and off and drops empty days", () => {
    const on = toggleSlot({}, "mon", "evening");
    expect(on).toEqual({ mon: ["evening"] });
    expect(toggleSlot(on, "mon", "evening")).toEqual({});
    expect(toggleSlot(on, "mon", "morning")).toEqual({ mon: ["morning", "evening"] });
  });

  it("applies presets without duplicates and counts slots", () => {
    const a = withSlots({ mon: ["evening"] }, ["mon", "tue"], ["evening"]);
    expect(a).toEqual({ mon: ["evening"], tue: ["evening"] });
    expect(countSlots(withSlots(a, ["sat", "sun"], ["morning", "day"]))).toBe(6);
  });

  it("formats day runs", () => {
    expect(formatDayRuns(["mon", "tue", "wed", "thu"])).toBe("Mon–Thu");
    expect(formatDayRuns(["sat", "mon", "sun"])).toBe("Mon, Sat, Sun");
    expect(formatDayRuns(["mon", "wed", "thu", "fri"])).toBe("Mon, Wed–Fri");
  });

  it("summarises availability", () => {
    expect(
      summariseAvailability({ mon: ["evening"], tue: ["evening"], wed: ["evening"], thu: ["evening"], sat: ["day"] }),
    ).toBe("Afternoons Sat · Evenings Mon–Thu");
    expect(summariseAvailability(withSlots({}, ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], ["morning"]))).toBe(
      "Mornings every day",
    );
    expect(summariseAvailability({})).toBe("");
  });
});

describe("profile schema", () => {
  it("prefills defaults from a fresh profile", () => {
    const d = draftFromProfile({ full_name: " Nina Newbie " });
    expect(d.full_name).toBe("Nina Newbie");
    expect(d.university).toBe("Imperial College London");
    expect(d.location_preference).toBe("London");
    expect(d.availability).toEqual({});
  });

  it("accepts a complete draft and cleans it for the database", () => {
    const parsed = profilePrefsSchema.parse(
      draft({
        department: "  Business School ",
        course: "",
        career_interests: ["finance", "finance", "consulting"],
        preferred_formats: ["in_person"],
        location_preference: "",
        availability: { mon: ["evening"] },
      }),
    );
    expect(parsed.department).toBe("Business School");
    expect(parsed.course).toBeNull();
    expect(parsed.location_preference).toBeNull();
    expect(parsed.career_interests).toEqual(["finance", "consulting"]);
    expect(parsed.availability).toEqual({ mon: ["evening"] });
  });

  it("stores empty availability as null", () => {
    expect(profilePrefsSchema.parse(draft({ availability: {} })).availability).toBeNull();
  });

  it("rejects unknown interests, formats and malformed category slugs", () => {
    expect(profilePrefsSchema.safeParse(draft({ career_interests: ["astrology"] })).success).toBe(false);
    expect(profilePrefsSchema.safeParse(draft({ preferred_formats: ["telepathy"] })).success).toBe(false);
    expect(profilePrefsSchema.safeParse(draft({ preferred_categories: ["Drop Table"] })).success).toBe(false);
  });

  it("reports per-step errors", () => {
    expect(stepErrors("basics", draft({ full_name: "  " }))).toEqual({ full_name: "Tell us your name" });
    expect(stepErrors("career", draft({ career_interests: [] }))).toEqual({
      career_interests: "Pick at least one career interest",
    });
    expect(stepErrors("personal", draft())).toEqual({});
    expect(stepErrors("availability", draft())).toEqual({});
    expect(Object.keys(draftErrors(draft({ full_name: "", career_interests: [] })))).toEqual([
      "full_name",
      "career_interests",
    ]);
  });

  it("keeps only known categories", () => {
    expect(keepKnownCategories(["workshop", "ghost"], ["workshop", "social"])).toEqual(["workshop"]);
  });
});

describe("hasEnded", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  it("uses the end time when there is one, otherwise the start", () => {
    expect(hasEnded({ starts_at: "2026-10-16T10:00:00Z", ends_at: "2026-10-16T13:00:00Z" }, now)).toBe(false);
    expect(hasEnded({ starts_at: "2026-10-16T10:00:00Z", ends_at: "2026-10-16T11:00:00Z" }, now)).toBe(true);
    expect(hasEnded({ starts_at: "2026-10-16T11:59:00Z", ends_at: null }, now)).toBe(true);
    expect(hasEnded({ starts_at: "2026-10-17T10:00:00Z", ends_at: null }, now)).toBe(false);
  });
});
