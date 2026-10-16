"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, getMyOrganisers, getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { hasHostGoal, landingPath } from "./flow";
import { cleanForType, draftErrors, keepKnownCategories, profilePrefsSchema, stepErrors } from "./schema";

export type SaveProfileResult =
  | { ok: true; message: string; redirectTo?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

type Mode = "onboarding" | "preferences";

/** Validates and writes the answers to the signed-in user's own profile (RLS-scoped). */
async function writeProfile(input: unknown, mode: Mode, extra: { onboarded_at?: string } = {}): Promise<SaveProfileResult> {
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

  const supabase = await createClient();
  const { data: cats } = await supabase.from("categories").select("slug");
  const prefs = cleanForType(parsed.data);

  const { error } = await supabase
    .from("profiles")
    .update({
      ...prefs,
      preferred_categories: keepKnownCategories(prefs.preferred_categories, (cats ?? []).map((c) => c.slug as string)),
      ...extra,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your profile. Try again." };

  // During onboarding the wizard is still mid-flow (the organisation step comes next); re-rendering
  // /onboarding now would bounce them out because they count as onboarded. They navigate away fresh.
  if (mode === "preferences") revalidatePath("/", "layout");
  return { ok: true, message: "Preferences saved" };
}

/**
 * /onboarding: saves the profile answers and marks onboarding done. Returns where to go next
 * (Studio for hosts, otherwise the safe `next` path or For You); the wizard decides whether the
 * organisation step comes first.
 */
export async function completeOnboarding(input: unknown, next?: string | null): Promise<SaveProfileResult & { landing?: string }> {
  const result = await writeProfile(input, "onboarding", { onboarded_at: new Date().toISOString() });
  if (!result.ok) return result;
  const goals = (input as { goals?: string[] }).goals ?? [];
  return { ...result, landing: landingPath(goals, next) };
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
