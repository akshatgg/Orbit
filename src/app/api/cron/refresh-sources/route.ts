import { NextResponse, type NextRequest } from "next/server";
import { getProfile, isAdmin } from "@/lib/auth";
import { refreshAllSources } from "@/lib/sources/engine";
import { authoriseRefresh } from "@/lib/sources/refresh-auth";

// One entry point for a full refresh of every enabled source (then expiry and duplicate checks):
// GET  — Vercel cron (daily 03:00 UTC, see vercel.json) with Authorization: Bearer $CRON_SECRET.
// POST — the "Refresh all now" button on /admin/sources, for signed-in admins on this site.
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const auth = authoriseRefresh({
    method: "GET",
    authorization: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
  });
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: auth.status });
  const summary = await refreshAllSources({ trigger: auth.trigger });
  return NextResponse.json(summary, { status: summary.errors.length ? 500 : 200 });
}

export async function POST(request: NextRequest) {
  const profile = await getProfile();
  const auth = authoriseRefresh({
    method: "POST",
    isAdmin: isAdmin(profile),
    origin: request.headers.get("origin"),
    host: request.headers.get("x-forwarded-host") ?? request.headers.get("host"),
  });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.status === 403 ? "Forbidden" : "Sign in as an admin to refresh sources." }, { status: auth.status });
  }
  const summary = await refreshAllSources({ trigger: auth.trigger });
  return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
}
