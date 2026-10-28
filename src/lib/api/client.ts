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

type QueryValue = string | number | boolean | undefined | null;
/** Query parameters; an array repeats the key (`?tag=a&tag=b`). */
export type Query = Record<string, QueryValue | readonly QueryValue[]>;

export type RequestOptions = Omit<RequestInit, "body"> & {
  query?: Query;
  body?: unknown;
  /** Seconds to cache the response for. Omit for per-request freshness. */
  revalidate?: number;
  /** Bearer token for signed-in calls. */
  token?: string;
};

async function send(path: string, { query, body, revalidate, token, headers, ...init }: RequestOptions = {}): Promise<Response> {
  const url = new URL(`${BACKEND_URL}${API_PREFIX}${path}`);
  for (const [key, raw] of Object.entries(query ?? {})) {
    for (const value of Array.isArray(raw) ? raw : [raw]) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, String(value));
      }
    }
  }

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(body === undefined || isForm ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      signal: init.signal ?? AbortSignal.timeout(12_000),
      redirect: init.redirect ?? "follow",
      ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate } }),
    });
  } catch (cause) {
    throw new ApiError(0, `Cannot reach the Orbit API at ${BACKEND_URL}`, cause);
  }

  if (!response.ok && !(init.redirect === "manual" && response.status >= 300 && response.status < 400)) {
    const payload = (await response.json().catch(() => null)) as { detail?: unknown } | null;
    const detail = typeof payload?.detail === "string" ? payload.detail : response.statusText;
    throw new ApiError(response.status, detail, payload);
  }
  return response;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  const text = response.status === 204 ? "" : await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "POST" }),
  patch: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "PATCH" }),
  put: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "PUT" }),
  del: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
  /** The raw response (files, redirects); throws `ApiError` like the others. */
  raw: (path: string, options?: RequestOptions) => send(path, { method: "GET", ...options }),
};

/** True when the backend URL is configured; lets unconfigured previews render. */
export const isBackendConfigured = Boolean(BACKEND_URL);
