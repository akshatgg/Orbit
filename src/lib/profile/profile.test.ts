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
  cleanForType,
  draftFromProfile,
  draftErrors,
  keepKnownCategories,
  profilePrefsSchema,
  stepErrors,
  validateUserTypeFields,
  type ProfileDraft,
} from "./schema";
import { effectiveUserType, usesUniversitySignals } from "./user-type";
import { hasEnded } from "./events";

const draft = (patch: Partial<ProfileDraft> = {}): ProfileDraft => ({
  ...draftFromProfile({ full_name: "Sam Student", user_type: "student", goals: ["career"] }),
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
    expect(stepErrors("describe", draft({ full_name: "  " }))).toEqual({ full_name: "Tell us your name" });
    expect(stepErrors("describe", draft({ user_type: "" }))).toEqual({ user_type: "Pick what describes you" });
    expect(stepErrors("interests", draft({ career_interests: [], personal_interests: [] }))).toEqual({
      career_interests: "Pick at least one interest",
    });
    expect(stepErrors("interests", draft({ career_interests: [], personal_interests: ["fitness"] }))).toEqual({});
    expect(stepErrors("goals", draft({ goals: [] }))).toEqual({ goals: "Pick at least one" });
    expect(stepErrors("availability", draft())).toEqual({});
    expect(Object.keys(draftErrors(draft({ full_name: "", career_interests: [] })))).toEqual([
      "full_name",
      "career_interests",
    ]);
  });

  it("host-only needs a name and role but no interests", () => {
    const host = draft({ goals: ["host"], user_type: "", career_interests: [], full_name: "Olu", host_role: "Society president" });
    expect(draftErrors(host)).toEqual({});
    expect(draftErrors({ ...host, host_role: "" })).toEqual({ host_role: "Tell us your role" });
    expect(profilePrefsSchema.parse(host).user_type).toBeNull();
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

describe("user types", () => {
  it("infers the type of older accounts", () => {
    expect(effectiveUserType({ user_type: null, university: "Imperial College London" })).toBe("student");
    expect(effectiveUserType({ user_type: null, university: null })).toBe("other");
    expect(effectiveUserType({ user_type: "professional", university: "Imperial College London" })).toBe("professional");
    expect(effectiveUserType({ user_type: "bogus", university: null })).toBe("other");
    expect(effectiveUserType(null)).toBe("other");
    expect(usesUniversitySignals("student")).toBe(true);
    expect(usesUniversitySignals("graduate")).toBe(true);
    expect(usesUniversitySignals("professional")).toBe(false);
    expect(usesUniversitySignals("other")).toBe(false);
  });

  it("prefills the draft: stored type, inferred student, or nothing for a new user", () => {
    expect(draftFromProfile({ user_type: "graduate", graduation_year: 2024 })).toMatchObject({ user_type: "graduate", graduation_year: "2024" });
    expect(draftFromProfile({ university: "Imperial College London" }).user_type).toBe("student");
    expect(draftFromProfile({ full_name: "Nina" }).user_type).toBe("");
  });

  it("validates the follow-up fields for each type", () => {
    expect(validateUserTypeFields({ user_type: "student", university: "" })).toEqual({ university: "Pick your university" });
    expect(validateUserTypeFields({ user_type: "student", university: "Imperial College London" })).toEqual({});
    expect(validateUserTypeFields({ user_type: "graduate", university: "UCL", graduation_year: null }, 2026)).toEqual({
      graduation_year: "When did you graduate?",
    });
    expect(validateUserTypeFields({ user_type: "graduate", university: "UCL", graduation_year: 2030 }, 2026).graduation_year).toMatch(/between 1950 and 2027/);
    expect(validateUserTypeFields({ user_type: "graduate", university: "UCL", graduation_year: 2024 }, 2026)).toEqual({});
    expect(validateUserTypeFields({ user_type: "professional" })).toEqual({});
    expect(validateUserTypeFields({ user_type: "other" })).toEqual({});
  });

  it("requires a graduation year for graduates through the step schema", () => {
    expect(stepErrors("describe", draft({ user_type: "graduate", graduation_year: "" }))).toEqual({ graduation_year: "When did you graduate?" });
    expect(stepErrors("describe", draft({ user_type: "graduate", graduation_year: "20x4" }))).toHaveProperty("graduation_year");
    expect(stepErrors("describe", draft({ user_type: "graduate", graduation_year: "2024" }))).toEqual({});
    expect(stepErrors("describe", draft({ user_type: "professional", university: "", company: "" }))).toEqual({});
    expect(stepErrors("describe", draft({ user_type: "other", university: "" }))).toEqual({});
  });

  it("parses the graduation year to a number and clears fields that don't belong to the type", () => {
    const prof = cleanForType(
      profilePrefsSchema.parse(
        draft({ user_type: "professional", company: "Acme", job_title: "Recruiter", course: "MSc Management", year_of_study: "Master's", graduation_year: "2020" }),
      ),
    );
    expect(prof).toMatchObject({ company: "Acme", job_title: "Recruiter", university: null, course: null, year_of_study: null, graduation_year: null });

    const grad = cleanForType(profilePrefsSchema.parse(draft({ user_type: "graduate", graduation_year: "2024", course: "x", company: "y" })));
    expect(grad).toMatchObject({ graduation_year: 2024, university: "Imperial College London", course: null, company: null });

    const student = cleanForType(profilePrefsSchema.parse(draft({ company: "y", host_role: "Chair" })));
    expect(student).toMatchObject({ company: null, host_role: null, course: null });
    expect(student.university).toBe("Imperial College London");
  });

  it("only keeps the host role for hosts", () => {
    const host = cleanForType(profilePrefsSchema.parse(draft({ goals: ["career", "host"], host_role: " Recruiter " })));
    expect(host.host_role).toBe("Recruiter");
  });
});
