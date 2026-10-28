import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import type { Organiser, Profile } from "@/types/database";
import { apiAs, getSession } from "./api/session";

/**
 * Data access layer for "who is signed in".
 *
 * Everything comes from the Orbit API — Supabase is not involved. Each helper
 * is deduplicated per request; call them inside a <Suspense> boundary.
 */

export type CurrentUser = { id: string; email: string | null };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // A session check must never be prerendered.
  await connection();
  const session = await getSession();
  if (!session) return null;
  return { id: session.id, email: session.email ?? null };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  await connection();
  const me = await apiAs<{ profile: Profile }>("/me");
  return me?.profile ?? null;
});

/** Redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirects to /login when signed out and /onboarding until onboarding is finished. */
export async function requireProfile(): Promise<Profile> {
  await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");
  if (!profile.onboarded_at) redirect("/onboarding");
  return profile;
}

export function isAdmin(profile: Pick<Profile, "role"> | null): boolean {
  return profile?.role === "admin" || profile?.role === "super_admin";
}

export function isSuperAdmin(profile: Pick<Profile, "role"> | null): boolean {
  return profile?.role === "super_admin";
}

/** Redirects unless the signed-in person can administer Orbit. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin" && profile.role !== "super_admin") redirect("/");
  return profile;
}

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "super_admin") redirect("/admin");
  return profile;
}

export type MyOrganiser = Organiser & { member_role: "owner" | "editor" };

/** Organisers the signed-in user belongs to (any status). */
export const getMyOrganisers = cache(async (): Promise<MyOrganiser[]> => {
  const me = await apiAs<{ organisers: (Organiser & { role: "owner" | "editor" })[] }>("/me");
  return (me?.organisers ?? []).map(({ role, ...organiser }) => ({ ...organiser, member_role: role }));
});
