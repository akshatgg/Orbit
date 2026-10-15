import "server-only";
import type Stripe from "stripe";
import { notifyRegistrationChanged } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { shouldFulfil } from "./logic";

// Paid hand-off: turns a paid Checkout Session into a confirmed ticket.
// Called from the webhook and the success page; safe to call any number of times.

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

export type FulfilResult = "marked" | "already" | "skipped";

/**
 * Marks the registration in `session.metadata.registration_id` as paid (status going) when Stripe
 * says the session is paid. Uses the service client: only Stripe data (never user input) gets here.
 */
export async function fulfilCheckoutSession(session: Stripe.Checkout.Session): Promise<FulfilResult> {
  if (!shouldFulfil(session)) return "skipped";
  const registrationId = session.metadata!.registration_id;
  const admin = createAdminClient();

  const { data: current, error: readError } = await admin
    .from("registrations")
    .select("id, status, payment_status, stripe_checkout_session_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) {
    console.warn("[payments] paid session for a registration that no longer exists", session.id, registrationId);
    return "skipped";
  }
  if (current.payment_status === "paid") {
    if (current.stripe_checkout_session_id && current.stripe_checkout_session_id !== session.id) {
      // Two different checkouts were paid for one ticket — refund one in the Stripe dashboard.
      console.warn("[payments] possible duplicate payment", { registrationId, paid: current.stripe_checkout_session_id, extra: session.id });
    }
    return "already";
  }

  const { error } = await admin.rpc("mark_registration_paid", {
    p_registration_id: registrationId,
    p_checkout_session_id: session.id,
    p_payment_intent_id: paymentIntentId(session),
  });
  if (error) throw error;

  const { data: after } = await admin
    .from("registrations")
    .select("payment_status")
    .eq("id", registrationId)
    .maybeSingle();
  if (after?.payment_status !== "paid") {
    // mark_registration_paid only moves awaiting_payment / cancelled / waitlisted registrations.
    console.warn("[payments] paid session didn't update registration", { registrationId, status: current.status });
    return "skipped";
  }
  // "You're in" — never throws, so a notification problem can't undo the payment hand-off.
  await notifyRegistrationChanged(registrationId);
  return "marked";
}
