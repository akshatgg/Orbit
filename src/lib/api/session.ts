import "server-only";

import { cookies } from "next/headers";

import { api, ApiError, type RequestOptions } from "./client";
import { SESSION_COOKIE } from "./session-cookie";

/**
 * The Orbit session.
 *
 * The backend sets `orbit_session` (httpOnly, JWT) when someone signs in. In
 * production it is scoped to the shared parent domain, so the frontend receives
 * it too; in development the frontend and API share the host `localhost`.
 * Server Components, Actions and Route Handlers forward it as a bearer token —
 * no browser-side token, no CORS.
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

/** An authenticated GET, or null when signed out (no cookie, or the backend says 401). */
export async function apiAs<T>(path: string, options: RequestOptions = {}): Promise<T | null> {
  const token = await sessionToken();
  if (!token) return null;
  try {
    return await api.get<T>(path, { ...options, token });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

async function requireToken() {
  const token = await sessionToken();
  // A missing cookie is the same as a rejected one: the caller is signed out.
  if (!token) throw new ApiError(401, "not_authenticated");
  return token;
}

async function withToken<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, options: RequestOptions = {}) {
  const token = await requireToken();
  const call = { GET: api.get, POST: api.post, PATCH: api.patch, PUT: api.put, DELETE: api.del }[method];
  return call<T>(path, { ...options, token });
}

/**
 * Authenticated calls as the signed-in person. Each throws `ApiError`:
 * status 401 when signed out, 403/404/409/422 with the backend's `detail` code.
 * Turn one into user-facing copy with `apiMessage` (`./errors`).
 */
export const authed = {
  get: <T>(path: string, options?: RequestOptions) => withToken<T>("GET", path, options),
  post: <T>(path: string, options?: RequestOptions) => withToken<T>("POST", path, options),
  patch: <T>(path: string, options?: RequestOptions) => withToken<T>("PATCH", path, options),
  put: <T>(path: string, options?: RequestOptions) => withToken<T>("PUT", path, options),
  del: <T>(path: string, options?: RequestOptions) => withToken<T>("DELETE", path, options),
  /** The raw response (CSV, iCal, redirects). */
  raw: async (path: string, options?: RequestOptions) => api.raw(path, { ...options, token: await requireToken() }),
};

export async function getSession(): Promise<SessionUser | null> {
  return apiAs<SessionUser>("/auth/session");
}
