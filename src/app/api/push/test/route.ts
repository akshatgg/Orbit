import { NextResponse, type NextRequest } from "next/server";
import { authed } from "@/lib/api/session";
import { apiErrorResponse, badRequest } from "../_shared";

// Sends a test push to the signed-in user's devices (delivered by the Orbit API).
export async function POST(request: NextRequest) {
  const bad = badRequest(request);
  if (bad) return bad;
  try {
    const result = await authed.post<Record<string, unknown>>("/push/test");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return apiErrorResponse(
      error,
      {
        push_not_configured: "Push isn't set up on the server yet",
        no_push_subscriptions: "Turn on push notifications first",
        push_unreachable: "Couldn't reach your device. Try turning push off and on again.",
      },
      "Couldn't send a test notification",
    );
  }
}
