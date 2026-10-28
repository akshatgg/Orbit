import { NextResponse, type NextRequest } from "next/server";
import { cronAuthorised, forwardToBackend } from "@/lib/cron/forward";

export const maxDuration = 300;

// Daily at 08:00 UTC (vercel.json). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`;
// the reminders themselves run on the Orbit API, which checks the same secret.
export async function GET(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!cronAuthorised(authorization)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return forwardToBackend("/cron/reminders", { method: "GET", authorization: authorization! });
}
