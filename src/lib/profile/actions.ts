"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { draftErrors, keepKnownCategories, profilePrefsSchema } from "./schema";

export type SaveProfileResult =
  | { ok: true; message: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Validates and writes the onboarding answers to the signed-in user's own profile (RLS-scoped). */
async function writeProfile(input: unknown, extra: { onboarded_at?: string } = {}): Promise<SaveProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Your session has ended. Sign in again." };

  const parsed = profilePrefsSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors = draftErrors(input as never);
    return { ok: false, error: Object.values(fieldErrors)[0] ?? "Check your answers and try again.", fieldErrors };
  }

  const supabase = await createClient();
  const { data: cats } = await supabase.from("categories").select("slug");
  const prefs = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      ...prefs,
      preferred_categories: keepKnownCategories(prefs.preferred_categories, (cats ?? []).map((c) => c.slug as string)),
      ...extra,
    })
    .eq("id", user.id);
  if (error) return { ok: false, error: "Couldn't save your profile. Try again." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Preferences saved" };
}

/** Final step of /onboarding: saves everything, marks onboarding done and opens the For You feed. */
export async function completeOnboarding(input: unknown): Promise<SaveProfileResult> {
  const result = await writeProfile(input, { onboarded_at: new Date().toISOString() });
  if (!result.ok) return result;
  redirect("/");
}

/** /profile/preferences: saves edits without touching onboarding state. */
export async function savePreferences(input: unknown): Promise<SaveProfileResult> {
  return writeProfile(input);
}
