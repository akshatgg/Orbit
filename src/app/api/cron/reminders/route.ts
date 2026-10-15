import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/notifications/reminders";

export const maxDuration = 300;

// Daily at 08:00 UTC (vercel.json). Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runReminders(new Date());
    console.info("[cron/reminders]", summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[cron/reminders] failed", err);
    return NextResponse.json({ error: "Reminders failed" }, { status: 500 });
  }
}
