import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authorise } from "../_shared";

// Saves / removes this browser's push subscription for the signed-in user (their session + RLS).
// The service worker also posts here when the browser rotates a subscription.

const subscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(16).max(200),
    auth: z.string().min(8).max(100),
  }),
});

const saveSchema = z.object({
  subscription: subscriptionSchema,
  oldEndpoint: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest) {
  const auth = await authorise(request);
  if ("error" in auth) return auth.error;

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const { subscription, oldEndpoint } = parsed.data;

  const { error } = await auth.supabase.rpc("save_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.keys.p256dh,
    p_auth: subscription.keys.auth,
    p_user_agent: request.headers.get("user-agent"),
  });
  if (error) {
    console.error("[push/subscribe] save failed", error.message);
    return NextResponse.json({ error: "Couldn't save this device" }, { status: 500 });
  }
  if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
    await auth.supabase.from("push_subscriptions").delete().eq("endpoint", oldEndpoint);
  }
  return NextResponse.json({ ok: true });
}

const removeSchema = z.object({ endpoint: z.string().min(1).max(1000) });

export async function DELETE(request: NextRequest) {
  const auth = await authorise(request);
  if ("error" in auth) return auth.error;

  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { error } = await auth.supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  if (error) {
    console.error("[push/subscribe] delete failed", error.message);
    return NextResponse.json({ error: "Couldn't remove this device" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
