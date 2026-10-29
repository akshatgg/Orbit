import { NextResponse, type NextRequest } from "next/server";
import { listShareable } from "@/lib/social/queries";
import { json, SAFE_ID } from "../_shared";

/** Circles and communities the signed-in person can share this event to, with `already_shared`. */
export async function GET(request: NextRequest) {
  const eventId = request.nextUrl.searchParams.get("event_id") ?? "";
  if (!SAFE_ID.test(eventId)) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  return json(async () => ({ items: await listShareable(eventId) }));
}
