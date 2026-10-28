import "server-only";

/**
 * Server-side client for the Orbit API (FastAPI).
 *
 * Only Server Components, Server Actions and Route Handlers may call this —
 * the backend is never addressed from the browser, so the session stays in an
 * httpOnly cookie on Orbit's own domain and no CORS is involved.
 */

const BACKEND_URL = (process.env.BACKEND_URL ?? "http://localhost:8090").replace(/\/$/, "");
const API_PREFIX = "/api";

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

type RequestOptions = Omit<RequestInit, "body"> & {
  query?: Query;
  body?: unknown;
  /** Seconds to cache the response for. Omit for per-request freshness. */
  revalidate?: number;
  /** Bearer token for signed-in calls. */
  token?: string;
};

async function request<T>(path: string, { query, body, revalidate, token, headers, ...init }: RequestOptions = {}): Promise<T> {
  const url = new URL(`${BACKEND_URL}${API_PREFIX}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
      ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }),
    });
  } catch (cause) {
    throw new ApiError(0, `Cannot reach the Orbit API at ${BACKEND_URL}`, cause);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
    throw new ApiError(response.status, payload?.detail ?? response.statusText, payload);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "POST" }),
  patch: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "PATCH" }),
  put: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "PUT" }),
  del: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),

  /**
   * A read that must not take the page down.
   *
   * Returns `fallback` when the backend is unreachable or answers 5xx — an API
   * restart should cost a section, not the whole route. A 4xx still throws:
   * that is a bug in the call, and swallowing it would hide the bug.
   */
  getOr: async <T>(path: string, fallback: T, options?: RequestOptions): Promise<T> => {
    try {
      return await request<T>(path, { ...options, method: "GET" });
    } catch (error) {
      if (error instanceof ApiError && error.status !== 0 && error.status < 500) throw error;
      console.warn(`[orbit-api] ${path} unavailable, using fallback:`, error instanceof Error ? error.message : error);
      return fallback;
    }
  },
};

/** True when the backend URL is configured; lets unconfigured previews render. */
export const isBackendConfigured = Boolean(BACKEND_URL);
