import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { authed } from "@/lib/api/session";
import { apiErrorResponse, badRequest } from "../_shared";

// Saves / removes this browser's push subscription for the signed-in user (through the Orbit API).
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
  const bad = badRequest(request);
  if (bad) return bad;

  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const { subscription, oldEndpoint } = parsed.data;

  try {
    await authed.post("/push/subscriptions", {
      body: {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
        old_endpoint: oldEndpoint && oldEndpoint !== subscription.endpoint ? oldEndpoint : null,
      },
    });
  } catch (error) {
    return apiErrorResponse(error, {}, "Couldn't save this device");
  }
  return NextResponse.json({ ok: true });
}

const removeSchema = z.object({ endpoint: z.string().min(1).max(1000) });

export async function DELETE(request: NextRequest) {
  const bad = badRequest(request);
  if (bad) return bad;

  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    await authed.del("/push/subscriptions", { body: { endpoint: parsed.data.endpoint } });
  } catch (error) {
    return apiErrorResponse(error, {}, "Couldn't remove this device");
  }
  return NextResponse.json({ ok: true });
}
