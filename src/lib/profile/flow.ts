// Pure routing logic for the onboarding flow: which goals exist, which steps a person sees for
// the goals they picked, and where they land when they finish. No I/O so it is easy to test.

export const GOALS = [
  { value: "career", emoji: "💼", title: "Find career events", hint: "Employer sessions, fairs, workshops" },
  { value: "network", emoji: "🤝", title: "Grow my network", hint: "Panels, mixers, founders and alumni" },
  { value: "social", emoji: "🎉", title: "Meet people", hint: "Socials, sport and society nights" },
  { value: "host", emoji: "🚀", title: "Host events", hint: "For my society, team or company" },
] as const;

export type Goal = (typeof GOALS)[number]["value"];

export const GOAL_VALUES = GOALS.map((g) => g.value) as [Goal, ...Goal[]];

/** Goals that mean "I'm here to find events" and unlock the interest questions. */
export const EXPLORER_GOALS: readonly Goal[] = ["career", "network", "social"];

/** Known goals only, de-duplicated, in the canonical order of GOALS. */
export function normalizeGoals(input: readonly string[] | null | undefined): Goal[] {
  const set = new Set(input ?? []);
  return GOAL_VALUES.filter((g) => set.has(g));
}

export const hasExplorerGoal = (goals: readonly string[] | null | undefined) =>
  (goals ?? []).some((g) => (EXPLORER_GOALS as readonly string[]).includes(g));

export const hasHostGoal = (goals: readonly string[] | null | undefined) => (goals ?? []).includes("host");

/** Only Host is ticked: no interest questions, straight to the organisation. */
export const isHostOnly = (goals: readonly string[] | null | undefined) =>
  hasHostGoal(goals) && !hasExplorerGoal(goals);

export type StepKey = "goals" | "describe" | "interests" | "events" | "availability" | "about" | "organisation";

/**
 * The questions to ask, in order. Anyone who is not purely a host gets the Explorer questions
 * (this includes people whose goals are not set yet, e.g. accounts from before goals existed).
 * Host + Explorer goals add the organisation step at the end; host-only skips every interest question.
 */
export function stepsFor(goals: readonly string[] | null | undefined): StepKey[] {
  if (isHostOnly(goals)) return ["goals", "about", "organisation"];
  const explorer: StepKey[] = ["goals", "describe", "interests", "events", "availability"];
  return hasHostGoal(goals) ? [...explorer, "organisation"] : explorer;
}

/** Steps that collect profile answers (everything except the organisation application). */
export const profileSteps = (goals: readonly string[] | null | undefined) =>
  stepsFor(goals).filter((s) => s !== "organisation");

/** Paths we never send someone back to after onboarding (it would loop or leave them stuck). */
const BLOCKED_PREFIXES = ["/onboarding", "/login", "/auth"];

/** A same-site relative path from `?next=`, or null when it is missing or unsafe. */
export function safeNextPath(raw: string | string[] | null | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.length > 500) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return null;
  // Reject control characters (header injection).
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  const path = value.split(/[?#]/)[0];
  if (BLOCKED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return value;
}

/**
 * Where onboarding ends. Hosts land in Studio (that is where their organisation's review status
 * lives); everyone else goes back to where they came from (a ticket, an event) or to For You.
 */
export function landingPath(goals: readonly string[] | null | undefined, next?: string | string[] | null): string {
  if (hasHostGoal(goals)) return "/organiser";
  return safeNextPath(next) ?? "/";
}

/** Whether the bottom tab bar should show the Studio tab. */
export function showsStudioTab(goals: readonly string[] | null | undefined, organisationCount: number) {
  return hasHostGoal(goals) || organisationCount > 0;
}

/** Whether `/onboarding?intent=host` should pre-select Host. */
export function initialGoals(intent: string | string[] | null | undefined, existing: readonly string[] | null | undefined): Goal[] {
  const current = normalizeGoals(existing);
  const wantsHost = (Array.isArray(intent) ? intent[0] : intent) === "host";
  return wantsHost && !current.includes("host") && current.length === 0 ? ["host"] : current;
}

export const HOST_ROLE_SUGGESTIONS = [
  "Society president",
  "Committee member",
  "Careers team",
  "Recruiter",
  "Community lead",
  "Event manager",
] as const;
