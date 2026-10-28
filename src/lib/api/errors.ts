import { ApiError } from "./client";

/**
 * Backend errors → what the person sees.
 *
 * The backend answers a refused call with `{"detail": "<code or sentence>"}`
 * (or a list of field problems for 422). `apiMessage` maps the code to the
 * copy a form shows; unknown codes fall back to a status-specific sentence.
 */

export const GENERIC_ERROR = "Something went wrong. Please try again.";

/** The backend's `detail` when it is a string, or the first field problem of a 422. */
export function apiErrorCode(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  const body = error.body as { detail?: unknown } | null;
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };
    if (typeof first?.msg === "string") return first.msg.replace(/^Value error, /, "");
  }
  return null;
}

export function isApiStatus(error: unknown, ...statuses: number[]): error is ApiError {
  return error instanceof ApiError && statuses.includes(error.status);
}

export const isSignedOut = (error: unknown) => isApiStatus(error, 401);
export const isForbidden = (error: unknown) => isApiStatus(error, 403);
export const isNotFound = (error: unknown) => isApiStatus(error, 404);
export const isConflict = (error: unknown) => isApiStatus(error, 409);

/** Copy for an error code; `null` keeps the fallback for that status. */
export type ErrorCopy = Record<string, string>;

/**
 * User-facing message for a failed backend call.
 *
 * - `copy[code]` when the backend's code is known to the caller;
 * - a short sentence the backend wrote itself (400/404/409/422 detail that reads
 *   as prose) when `passThrough` is on;
 * - otherwise a sentence per status. Errors that are not `ApiError` rethrow.
 */
export function apiMessage(
  error: unknown,
  copy: ErrorCopy = {},
  { fallback = GENERIC_ERROR, passThrough = false }: { fallback?: string; passThrough?: boolean } = {},
): string {
  if (!(error instanceof ApiError)) throw error;
  const code = apiErrorCode(error);
  if (code && copy[code]) return copy[code];
  switch (error.status) {
    case 0:
      return "Orbit is unreachable right now. Try again in a moment.";
    case 401:
      return "Sign in first";
    case 403:
      return code && passThrough && isSentence(code) ? code : "You don't have permission to do that";
    case 404:
      return code && passThrough && isSentence(code) ? code : "Not found";
    default:
      if (error.status >= 500) return fallback;
      return code && passThrough && isSentence(code) ? code : fallback;
  }
}

/** A detail written for people ("Event not found") rather than a code ("stripe_not_ready"). */
function isSentence(detail: string) {
  return /\s/.test(detail) && !/^[a-z0-9_]+$/.test(detail);
}
