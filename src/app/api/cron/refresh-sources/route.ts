import { NextResponse, type NextRequest } from "next/server";
import { sessionToken } from "@/lib/api/session";
import { cronAuthorised, forwardToBackend } from "@/lib/cron/forward";

// A full refresh of every enabled source runs on the Orbit API:
// GET  — Vercel cron (daily 03:00 UTC, see vercel.json) with Authorization: Bearer $CRON_SECRET.
// POST — the "Refresh all now" button on /admin/sources; the backend checks the caller is an admin.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!cronAuthorised(authorization)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return forwardToBackend("/cron/refresh-sources", { method: "GET", authorization: authorization! });
}

export async function POST(request: NextRequest) {
  // Same-site only: a form on another origin must not start a refresh with the admin's cookie.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const token = await sessionToken();
  if (!token) return NextResponse.json({ error: "Sign in as an admin to refresh sources." }, { status: 401 });
  return forwardToBackend("/cron/refresh-sources", { method: "POST", token });
}
