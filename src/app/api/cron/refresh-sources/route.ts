import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { refreshAllSources } from "@/lib/sources/engine";

// Vercel cron (daily 03:00 UTC, see vercel.json): refresh every enabled source,
// expire past events and flag duplicates.
export const maxDuration = 300;

function authorised(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await refreshAllSources();
  return NextResponse.json(summary, { status: summary.errors.length ? 500 : 200 });
}
