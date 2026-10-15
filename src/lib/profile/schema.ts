import { z } from "zod";
import { CAREER_INTERESTS, EVENT_FORMATS, PERSONAL_INTERESTS, UNIVERSITIES } from "@/lib/taxonomy";
import { normalizeAvailability, type Availability } from "./availability";

/** Everything the onboarding wizard and the preferences page edit. */
export type ProfileDraft = {
  full_name: string;
  university: string;
  department: string;
  course: string;
  year_of_study: string;
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
  university?: string | null;
  department?: string | null;
  course?: string | null;
  year_of_study?: string | null;
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
  return {
    full_name: p?.full_name?.trim() ?? "",
    university: p?.university?.trim() || DEFAULT_UNIVERSITY,
    department: p?.department ?? "",
    course: p?.course ?? "",
    year_of_study: p?.year_of_study ?? "",
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

export const basicsSchema = z.object({
  full_name: z.string().trim().min(1, "Tell us your name").max(80, "That name is too long"),
  university: z.string().trim().min(1, "Pick your university").max(120, "University name is too long"),
  department: optionalText(120, "Department"),
  course: optionalText(120, "Course"),
  year_of_study: optionalText(40, "Year of study"),
});

export const careerSchema = z.object({
  career_interests: uniqueList(z.enum(values(CAREER_INTERESTS)), CAREER_INTERESTS.length).refine(
    (l) => l.length >= 1,
    "Pick at least one career interest",
  ),
});

export const personalSchema = z.object({
  personal_interests: uniqueList(z.enum(values(PERSONAL_INTERESTS)), PERSONAL_INTERESTS.length),
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

/** Full payload accepted by the save actions. */
export const profilePrefsSchema = basicsSchema
  .extend(careerSchema.shape)
  .extend(personalSchema.shape)
  .extend(eventsSchema.shape)
  .extend(availabilitySchema.shape);

export type ProfilePrefsInput = z.input<typeof profilePrefsSchema>;
export type ProfilePrefs = z.output<typeof profilePrefsSchema>;

/** Wizard steps after the welcome screen, in order. */
export const STEPS = [
  { key: "basics", title: "About you", schema: basicsSchema },
  { key: "career", title: "Career interests", schema: careerSchema },
  { key: "personal", title: "Outside work", schema: personalSchema },
  { key: "events", title: "Your kind of events", schema: eventsSchema },
  { key: "availability", title: "When you're free", schema: availabilitySchema },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

/** Field → first error message for one step (empty object when the step is valid). */
export function stepErrors(step: StepKey, draft: ProfileDraft): Record<string, string> {
  const schema = STEPS.find((s) => s.key === step)!.schema;
  return issuesToErrors(schema.safeParse(draft));
}

/** Field → first error message for the whole form. */
export function draftErrors(draft: ProfileDraft): Record<string, string> {
  return issuesToErrors(profilePrefsSchema.safeParse(draft));
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
