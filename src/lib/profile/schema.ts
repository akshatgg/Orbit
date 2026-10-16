import { z } from "zod";
import { CAREER_INTERESTS, EVENT_FORMATS, PERSONAL_INTERESTS, UNIVERSITIES } from "@/lib/taxonomy";
import { normalizeAvailability, type Availability } from "./availability";
import { GOAL_VALUES, hasHostGoal, normalizeGoals, profileSteps, type Goal, type StepKey } from "./flow";
import {
  ALL_TYPE_FIELDS,
  FIELDS_BY_TYPE,
  USER_TYPE_VALUES,
  isUserType,
  type UserType,
} from "./user-type";

/** Everything the onboarding wizard and the preferences page edit. */
export type ProfileDraft = {
  full_name: string;
  goals: Goal[];
  /** "" until the person picks one. */
  user_type: UserType | "";
  university: string;
  department: string;
  course: string;
  year_of_study: string;
  graduation_year: string;
  company: string;
  industry: string;
  job_title: string;
  host_role: string;
  career_interests: string[];
  personal_interests: string[];
  preferred_categories: string[];
  preferred_formats: string[];
  location_preference: string;
  availability: Availability;
};

/** The subset of a profile row we read to build a draft. */
export type ProfileLike = {
  full_name?: string | null;
  goals?: string[] | null;
  user_type?: string | null;
  university?: string | null;
  department?: string | null;
  course?: string | null;
  year_of_study?: string | null;
  graduation_year?: number | null;
  company?: string | null;
  industry?: string | null;
  job_title?: string | null;
  host_role?: string | null;
  career_interests?: string[] | null;
  personal_interests?: string[] | null;
  preferred_categories?: string[] | null;
  preferred_formats?: string[] | null;
  location_preference?: string | null;
  availability?: unknown;
};

export const DEFAULT_UNIVERSITY = UNIVERSITIES[0];
export const DEFAULT_LOCATION = "London";

/** Prefills the wizard / preferences form from a profile row, with friendly defaults. */
export function draftFromProfile(p: ProfileLike | null | undefined): ProfileDraft {
  const raw = p?.user_type;
  // Accounts from before user types existed count as students when a university is set.
  const type: UserType | "" = isUserType(raw) ? raw : p?.university?.trim() ? "student" : "";
  return {
    full_name: p?.full_name?.trim() ?? "",
    goals: normalizeGoals(p?.goals),
    user_type: type,
    university: p?.university?.trim() || DEFAULT_UNIVERSITY,
    department: p?.department ?? "",
    course: p?.course ?? "",
    year_of_study: p?.year_of_study ?? "",
    graduation_year: p?.graduation_year ? String(p.graduation_year) : "",
    company: p?.company ?? "",
    industry: p?.industry ?? "",
    job_title: p?.job_title ?? "",
    host_role: p?.host_role ?? "",
    career_interests: p?.career_interests ?? [],
    personal_interests: p?.personal_interests ?? [],
    preferred_categories: p?.preferred_categories ?? [],
    preferred_formats: p?.preferred_formats ?? [],
    location_preference: p?.location_preference ?? DEFAULT_LOCATION,
    availability: normalizeAvailability(p?.availability),
  };
}

const values = <T extends readonly { value: string }[]>(list: T) =>
  list.map((o) => o.value) as [T[number]["value"], ...T[number]["value"][]];

/** Trimmed text; "" becomes null so optional columns stay empty rather than blank. */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long`)
    .transform((s) => (s === "" ? null : s));

const uniqueList = <T extends z.ZodType<string>>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .transform((list) => Array.from(new Set(list)));

const name = z.string().trim().min(1, "Tell us your name").max(80, "That name is too long");

/** Four-digit year as typed text → number | null. Range is checked by `validateUserTypeFields`. */
const yearText = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => {
    const s = String(v ?? "").trim();
    if (s === "") return null;
    return /^\d{4}$/.test(s) ? Number(s) : Number.NaN;
  })
  .refine((n) => n === null || !Number.isNaN(n), "Enter a four-digit year");

export const goalsSchema = z.object({
  goals: uniqueList(z.enum(GOAL_VALUES), GOAL_VALUES.length).refine((l) => l.length >= 1, "Pick at least one"),
});

const typeFields = {
  full_name: name,
  user_type: z.enum(USER_TYPE_VALUES, "Pick what describes you"),
  university: optionalText(120, "University"),
  department: optionalText(120, "Department"),
  course: optionalText(120, "Course"),
  year_of_study: optionalText(40, "Year of study"),
  graduation_year: yearText,
  company: optionalText(120, "Company"),
  industry: optionalText(120, "Industry"),
  job_title: optionalText(120, "Job title"),
};

type TypeInput = {
  user_type?: string | null;
  university?: string | null;
  graduation_year?: number | null;
};

/**
 * Rules that depend on the chosen type: students and graduates need a university, graduates a
 * graduation year (not in the far future). Everything else is optional.
 */
export function validateUserTypeFields(v: TypeInput, currentYear = new Date().getFullYear()): Record<string, string> {
  const errors: Record<string, string> = {};
  const type = v.user_type;
  if (type === "student" || type === "graduate") {
    if (!v.university?.trim()) errors.university = "Pick your university";
  }
  if (type === "graduate") {
    const y = v.graduation_year;
    if (y === null || y === undefined) errors.graduation_year = "When did you graduate?";
    else if (y < 1950 || y > currentYear + 1) errors.graduation_year = `Enter a year between 1950 and ${currentYear + 1}`;
  }
  return errors;
}

export const describeSchema = z.object(typeFields).superRefine((v, ctx) => {
  for (const [path, message] of Object.entries(validateUserTypeFields(v))) {
    ctx.addIssue({ code: "custom", path: [path], message });
  }
});

/** Host-only "About you". */
export const aboutSchema = z.object({
  full_name: name,
  host_role: z.string().trim().min(2, "Tell us your role").max(80, "Keep it under 80 characters"),
});

export const interestsSchema = z
  .object({
    career_interests: uniqueList(z.enum(values(CAREER_INTERESTS)), CAREER_INTERESTS.length),
    personal_interests: uniqueList(z.enum(values(PERSONAL_INTERESTS)), PERSONAL_INTERESTS.length),
  })
  .superRefine((v, ctx) => {
    if (v.career_interests.length + v.personal_interests.length === 0) {
      ctx.addIssue({ code: "custom", path: ["career_interests"], message: "Pick at least one interest" });
    }
  });

export const eventsSchema = z.object({
  preferred_categories: uniqueList(z.string().regex(/^[a-z0-9-]{1,60}$/, "Unknown category"), 50),
  preferred_formats: uniqueList(z.enum(values(EVENT_FORMATS)), EVENT_FORMATS.length),
  location_preference: optionalText(80, "Location"),
});

export const availabilitySchema = z.object({
  availability: z
    .record(z.string(), z.array(z.string()))
    .nullish()
    .transform((a) => {
      const clean = normalizeAvailability(a);
      return Object.keys(clean).length ? clean : null;
    }),
});

/**
 * Full payload accepted by the save actions. Lenient on purpose: which questions are *required*
 * depends on the goals, and that is checked by `draftErrors` (so a host-only profile saves fine
 * without any interests, and older accounts keep saving).
 */
export const profilePrefsSchema = z.object({
  full_name: name,
  goals: uniqueList(z.enum(GOAL_VALUES), GOAL_VALUES.length),
  user_type: z.union([z.enum(USER_TYPE_VALUES), z.literal("")]).transform((t) => (t === "" ? null : t)),
  university: optionalText(120, "University"),
  department: optionalText(120, "Department"),
  course: optionalText(120, "Course"),
  year_of_study: optionalText(40, "Year of study"),
  graduation_year: yearText,
  company: optionalText(120, "Company"),
  industry: optionalText(120, "Industry"),
  job_title: optionalText(120, "Job title"),
  host_role: optionalText(80, "Role"),
  career_interests: uniqueList(z.enum(values(CAREER_INTERESTS)), CAREER_INTERESTS.length),
  personal_interests: uniqueList(z.enum(values(PERSONAL_INTERESTS)), PERSONAL_INTERESTS.length),
  ...eventsSchema.shape,
  ...availabilitySchema.shape,
});

export type ProfilePrefsInput = z.input<typeof profilePrefsSchema>;
export type ProfilePrefs = z.output<typeof profilePrefsSchema>;

/**
 * Drops answers that don't belong to the chosen type (a professional has no course or university,
 * a student has no company) so old answers don't linger and leak into ranking.
 */
export function cleanForType(prefs: ProfilePrefs): ProfilePrefs {
  const keep = new Set<string>(prefs.user_type ? FIELDS_BY_TYPE[prefs.user_type] : []);
  const out: ProfilePrefs = { ...prefs };
  for (const f of ALL_TYPE_FIELDS) if (!keep.has(f)) (out as Record<string, unknown>)[f] = null;
  if (!hasHostGoal(prefs.goals)) out.host_role = null;
  return out;
}

type StepDef = { title: string; schema: z.ZodType };

/** Questions that collect profile answers, by step key. */
export const STEP_DEFS: Record<Exclude<StepKey, "organisation">, StepDef> = {
  goals: { title: "What brings you", schema: goalsSchema },
  describe: { title: "About you", schema: describeSchema },
  about: { title: "About you", schema: aboutSchema },
  interests: { title: "Interests", schema: interestsSchema },
  events: { title: "Your kind of events", schema: eventsSchema },
  availability: { title: "When you're free", schema: availabilitySchema },
};

/** Field → first error message for one step (empty object when the step is valid). */
export function stepErrors(step: Exclude<StepKey, "organisation">, draft: ProfileDraft): Record<string, string> {
  return issuesToErrors(STEP_DEFS[step].schema.safeParse(draft));
}

/** Field → first error for the steps this draft's goals ask about (not the goals step itself). */
export function draftErrors(draft: ProfileDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const step of profileSteps(draft.goals)) {
    if (step === "goals") continue;
    for (const [k, v] of Object.entries(stepErrors(step, draft))) errors[k] ??= v;
  }
  // Anything the steps don't cover (e.g. malformed values) still has to parse.
  for (const [k, v] of Object.entries(issuesToErrors(profilePrefsSchema.safeParse(draft)))) errors[k] ??= v;
  return errors;
}

function issuesToErrors(result: { success: boolean; error?: z.ZodError }) {
  const errors: Record<string, string> = {};
  if (result.success || !result.error) return errors;
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Keeps only category slugs that exist (the schema checks shape, the DB knows what's real). */
export function keepKnownCategories(selected: readonly string[], known: readonly string[]) {
  const set = new Set(known);
  return selected.filter((s) => set.has(s));
}
