import type Stripe from "stripe";
import { syncAccountStatus } from "@/lib/payments/connect";
import { fulfilCheckoutSession } from "@/lib/payments/fulfil";
import { getStripe, webhookSecrets } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe → ORBIT. Signed with STRIPE_WEBHOOK_SECRET (platform events) and, optionally,
// STRIPE_CONNECT_WEBHOOK_SECRET (connected-account events such as account.updated).
// Handled: checkout.session.completed / async_payment_succeeded → ticket paid; account.updated → sync.

function verify(stripe: Stripe, payload: string, signature: string): Stripe.Event | null {
  for (const secret of webhookSecrets()) {
    try {
      return stripe.webhooks.constructEvent(payload, signature, secret);
    } catch {
      // try the next secret
    }
  }
  return null;
}

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      await fulfilCheckoutSession(event.data.object);
      return;
    case "account.updated":
      await syncAccountStatus(event.data.object);
      return;
    default:
      return; // not ours
  }
}

export async function POST(request: Request) {
  const stripe = getStripe();
  if (!stripe || webhookSecrets().length === 0) {
    return Response.json({ error: "Payments are not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing Stripe-Signature header" }, { status: 400 });

  // Signature verification needs the exact raw body.
  const payload = await request.text();
  const event = verify(stripe, payload, signature);
  if (!event) return Response.json({ error: "Invalid signature" }, { status: 400 });

  // Skip events we've already processed (Stripe retries and may deliver twice).
  const admin = createAdminClient();
  const { data: claimed, error: logError } = await admin
    .from("stripe_events")
    .upsert(
      { id: event.id, type: event.type, account: event.account ?? null, livemode: event.livemode },
      { onConflict: "id", ignoreDuplicates: true },
    )
    .select("id");
  if (logError) {
    console.error("[stripe webhook] couldn't log event", event.id, logError);
    return Response.json({ error: "Temporary failure" }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) return Response.json({ received: true, duplicate: true });

  try {
    await handle(event);
  } catch (error) {
    console.error("[stripe webhook] failed", event.type, event.id, error);
    // Release the claim so Stripe's retry gets processed.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
