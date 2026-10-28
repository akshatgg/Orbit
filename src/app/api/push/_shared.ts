import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ApiError } from "@/lib/api/client";
import { apiMessage, type ErrorCopy } from "@/lib/api/errors";

/**
 * JSON-only and same-origin. Requiring `application/json` means a cross-site form can't post here
 * (browsers preflight JSON requests from other origins, and we never allow them). The Orbit API
 * checks the session on every call.
 */
export function badRequest(request: NextRequest) {
  const type = request.headers.get("content-type") ?? "";
  const origin = request.headers.get("origin");
  if (!type.includes("application/json") || (origin && origin !== request.nextUrl.origin)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  return null;
}

/** A refused API call as the `{ error }` JSON the browser helpers read. */
export function apiErrorResponse(error: unknown, copy: ErrorCopy, fallback: string) {
  if (!(error instanceof ApiError)) throw error;
  const status = error.status === 0 ? 502 : error.status;
  return NextResponse.json({ error: apiMessage(error, copy, { fallback }) }, { status });
}
