"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import { apiErrorCode } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { getCurrentUser, getMyOrganisers, getProfile } from "@/lib/auth";
import { hasHostGoal, landingPath } from "./flow";
import { cleanForType, draftErrors, profilePrefsSchema, stepErrors } from "./schema";

export type SaveProfileResult =
  | { ok: true; message: string; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type Mode = "onboarding" | "preferences";

/** Validates and writes the answers to the signed-in user's own profile. */
async function writeProfile(input: unknown, mode: Mode): Promise<SaveProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again." };

  const parsed = profilePrefsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = draftErrors(input as never);
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Check your answers and try again.", fieldErrors };
  }

  // Which questions are required depends on the goals the person picked.
  const draft = input as Parameters<typeof draftErrors>[0];
  const fieldErrors = { ...(mode === "onboarding" ? stepErrors("goals", draft) : {}), ...draftErrors(draft) };
  if (Object.keys(fieldErrors).length) {
    return { ok: false, error: Object.values(fieldErrors)[0], fieldErrors };
  }

  // The API keeps only category slugs that exist; onboarding also marks the profile onboarded.
  const prefs = cleanForType(parsed.data);
  try {
    if (mode === "onboarding") await authed.post("/me/onboarding", { body: prefs });
    else await authed.patch("/me", { body: prefs });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) return { ok: false, error: "Your session has ended. Sign in again." };
    if (error.status === 422) {
      console.error("[profile] save refused", apiErrorCode(error));
      return { ok: false, error: "Check your answers and try again." };
    }
    return { ok: false, error: "Couldn't save your profile. Try again." };
  }

  // During onboarding the wizard is still mid-flow (the organisation step comes next); re-rendering
  // /onboarding now would bounce them out because they count as onboarded. They navigate away fresh.
  if (mode === "preferences") revalidatePath("/", "layout");
  return { ok: true, message: "Preferences saved" };
}

/**
 * /onboarding: saves the profile answers and marks onboarding done. Hosts stay in the wizard (the
 * organisation step comes next); everyone else is sent on from here (the safe `next` path or For
 * You). Redirecting in the action matters: a refreshed session cookie re-renders /onboarding, which
 * now counts them as onboarded and would otherwise bounce them to Preferences.
 */
export async function completeOnboarding(input: unknown, next?: string | null): Promise<SaveProfileResult & { landing?: string }> {
  const result = await writeProfile(input, "onboarding");
  if (!result.ok) return result;
  const goals = (input as { goals?: string[] }).goals ?? [];
  const landing = landingPath(goals, next);
  if (!hasHostGoal(goals)) redirect(landing);
  return { ...result, landing };
}

/** /profile/preferences: saves edits without touching onboarding state. */
export async function savePreferences(input: unknown): Promise<SaveProfileResult> {
  const before = await getProfile();
  const result = await writeProfile(input, "preferences");
  if (!result.ok) return result;

  // Turning Host on without an organisation yet → straight to the application.
  const goals = (input as { goals?: string[] }).goals ?? [];
  if (hasHostGoal(goals) && !hasHostGoal(before?.goals)) {
    const orgs = await getMyOrganisers();
    if (orgs.length === 0) return { ...result, redirectTo: "/organiser/apply" };
  }
  return result;
}
