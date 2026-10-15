import { NextResponse, type NextRequest } from "next/server";
import { isPushConfigured, sendPush, type StoredSubscription } from "@/lib/notifications/channels";
import { testMessage } from "@/lib/notifications/messages";
import { authorise } from "../_shared";

// Sends a test push to the signed-in user's devices.
export async function POST(request: NextRequest) {
  const auth = await authorise(request);
  if ("error" in auth) return auth.error;
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Push isn't set up on the server yet" }, { status: 503 });
  }

  const { data, error } = await auth.supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", auth.userId);
  if (error) return NextResponse.json({ error: "Couldn't load your devices" }, { status: 500 });
  const subs = (data ?? []) as StoredSubscription[];
  if (subs.length === 0) {
    return NextResponse.json({ error: "Turn on push notifications first" }, { status: 400 });
  }

  const result = await sendPush(auth.supabase, subs, testMessage());
  console.info("[push/test]", auth.userId, result);
  if (result.delivered === 0) {
    return NextResponse.json({ error: "Couldn't reach your device. Try turning push off and on again.", ...result }, { status: 502 });
  }
  return NextResponse.json({ ok: true, ...result });
}
