import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Organiser, Profile } from "@/types/database";
import { createClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";

/**
 * Data access layer for "who is signed in". Every helper is deduplicated per request.
 * With Cache Components on, call these only inside a <Suspense> boundary.
 */

/** The signed-in user's id + email, or null. */
export const getCurrentUser = cache(async () => {
  // Session checks compare token expiry with the clock, so never prerender them.
  await connection();
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub as string, email: (claims.email as string | undefined) ?? null };
});

/** The signed-in user's profile row, or null. */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  return data;
});

/** Redirects to /login when signed out. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects to /login when signed out and /onboarding until onboarding is finished. */
export async function requireProfile(): Promise<Profile> {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.onboarded_at) redirect("/onboarding");
  return profile;
}

export function isAdmin(profile: Pick<Profile, "role"> | null) {
  return profile?.role === "admin" || profile?.role === "super_admin";
}

export function isSuperAdmin(profile: Pick<Profile, "role"> | null) {
  return profile?.role === "super_admin";
}

/** Admins and the super admin only; everyone else goes home. */
export async function requireAdmin(): Promise<Profile> {
  await requireUser();
  const profile = await getProfile();
  if (!isAdmin(profile)) redirect("/");
  return profile!;
}

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireAdmin();
  if (!isSuperAdmin(profile)) redirect("/admin");
  return profile;
}

export type MyOrganiser = Organiser & { member_role: "owner" | "editor" };

/** Organisers the signed-in user belongs to (any status). */
export const getMyOrganisers = cache(async (): Promise<MyOrganiser[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("organiser_members")
    .select("role, organisers(*)")
    .eq("user_id", user.id);
  return (data ?? [])
    .filter((row) => row.organisers)
    .map((row) => ({ ...(row.organisers as unknown as Organiser), member_role: row.role as "owner" | "editor" }));
});
