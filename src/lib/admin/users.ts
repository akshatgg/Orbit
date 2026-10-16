// Admin → Users: the "type" filter and how a profile shows up as a type + goals.

import { normalizeGoals } from "@/lib/profile/flow";
import { effectiveUserType, userTypeLabel, type UserType } from "@/lib/profile/user-type";

export const USER_TYPE_FILTERS = [
  { value: "", label: "All types" },
  { value: "student", label: "Students" },
  { value: "graduate", label: "Graduates" },
  { value: "professional", label: "Professionals" },
  { value: "other", label: "Other" },
  { value: "host", label: "Hosts" },
] as const;

export type UserTypeFilter = (typeof USER_TYPE_FILTERS)[number]["value"];

export function parseTypeFilter(raw: unknown): UserTypeFilter {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return USER_TYPE_FILTERS.some((f) => f.value === value) ? (value as UserTypeFilter) : "";
}

/**
 * PostgREST `or=` clause for a type filter, or null for "all" and "host" (host filters on goals).
 * Accounts from before user types existed count as students when they have a university.
 */
export function typeFilterClause(filter: UserTypeFilter): string | null {
  switch (filter) {
    case "student":
      return "user_type.eq.student,and(user_type.is.null,university.not.is.null)";
    case "other":
      return "user_type.eq.other,and(user_type.is.null,university.is.null)";
    case "graduate":
    case "professional":
      return `user_type.eq.${filter}`;
    default:
      return null;
  }
}

/** What to show in the Users table for one profile. */
export function describeUser(p: { user_type?: string | null; university?: string | null; goals?: string[] | null }) {
  const type: UserType = effectiveUserType(p);
  const goals = normalizeGoals(p.goals);
  return {
    type,
    typeLabel: userTypeLabel(type),
    /** Non-host goals as short labels ("Career", "Network", "Social"). */
    goalLabels: goals.filter((g) => g !== "host").map((g) => g[0].toUpperCase() + g.slice(1)),
    isHost: goals.includes("host"),
  };
}
