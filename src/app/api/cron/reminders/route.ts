import { NextResponse, type NextRequest } from "next/server";

// Placeholder — built by the "notifications" feature.
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, skipped: "not implemented yet" });
}
