import "server-only";

import { cookies } from "next/headers";

import { api, ApiError } from "./client";
import { SESSION_COOKIE } from "./session-cookie";

/**
 * The Orbit session.
 *
 * The backend sets `orbit_session` (httpOnly, JWT) when someone signs in. In
 * development the frontend and API share the host `localhost`, so the cookie is
 * already here. Server Components and Actions forward it as a bearer token —
 * no Supabase client, no browser-side token, no CORS.
 */

export { SESSION_COOKIE };

export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  onboarded: boolean;
};

export async function sessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** An authenticated call to the backend, or null when signed out. */
export async function apiAs<T>(path: string, options: Parameters<typeof api.get<T>>[1] = {}): Promise<T | null> {
  const token = await sessionToken();
  if (!token) return null;
  try {
    return await api.get<T>(path, { ...options, token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  return apiAs<SessionUser>("/auth/session");
}
