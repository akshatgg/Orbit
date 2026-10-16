// "Which describes you?": the four user types and which follow-up fields each one shows.

export const USER_TYPES = [
  { value: "student", label: "Student", emoji: "🎓", hint: "Studying at a university" },
  { value: "graduate", label: "Graduate", emoji: "🎒", hint: "Finished a degree" },
  { value: "professional", label: "Working professional", emoji: "💼", hint: "Recruiters and employers pick this" },
  { value: "other", label: "Other", emoji: "✨", hint: "Anything else" },
] as const;

export type UserType = (typeof USER_TYPES)[number]["value"];

export const USER_TYPE_VALUES = USER_TYPES.map((t) => t.value) as [UserType, ...UserType[]];

export type TypeField =
  | "university" | "department" | "course" | "year_of_study" | "graduation_year"
  | "company" | "industry" | "job_title";

/** Follow-up fields per type, in display order. */
export const FIELDS_BY_TYPE: Record<UserType, readonly TypeField[]> = {
  student: ["university", "department", "course", "year_of_study"],
  graduate: ["university", "graduation_year"],
  professional: ["company", "industry", "job_title"],
  other: [],
};

export const ALL_TYPE_FIELDS: readonly TypeField[] = [
  "university", "department", "course", "year_of_study", "graduation_year", "company", "industry", "job_title",
];

export const isUserType = (v: unknown): v is UserType => USER_TYPE_VALUES.includes(v as UserType);

/**
 * The type to use for a stored profile. Accounts created before user types existed have none:
 * they count as students when a university is set (that is who signed up), otherwise as "other".
 */
export function effectiveUserType(p: { user_type?: string | null; university?: string | null } | null | undefined): UserType {
  if (p && isUserType(p.user_type)) return p.user_type;
  return p?.university?.trim() ? "student" : "other";
}

/** Students and graduates have a university, a course and so on; the ranking uses those signals. */
export const usesUniversitySignals = (type: UserType) => type === "student" || type === "graduate";

export const userTypeLabel = (type: UserType) => USER_TYPES.find((t) => t.value === type)?.label ?? type;
