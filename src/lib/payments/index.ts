import "server-only";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { fulfilCheckoutSession } from "./fulfil";
import {
  SUPPORTED_CURRENCY,
  applicationFeePence,
  checkoutBlocker,
  checkoutExpiresAt,
  isOrganiserPayable,
  isReusableSession,
  lineItemName,
  toPence,
} from "./logic";
import { appBaseUrl, describeStripeError, getStripe, isPaymentsConfigured, platformFeePercent } from "./stripe";

// Paid tickets with Stripe Connect (Express, destination charges, GBP).
// The event page calls `createTicketCheckout` when a registration is `awaiting_payment`.

export { isPaymentsConfigured };

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

type RegistrationRow = {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  amount: number | string;
  currency: string;
  payment_status: string;
  stripe_checkout_session_id: string | null;
  updated_at: string;
  ticket_types: { name: string } | null;
  events: {
    id: string;
    title: string;
    status: string;
    starts_at: string;
    ends_at: string | null;
    organiser_id: string | null;
  } | null;
};

/** Starts checkout for a registration that is awaiting payment. Returns the URL to redirect to. */
export async function createTicketCheckout(registrationId: string): Promise<CheckoutResult> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Paid tickets aren't available on ORBIT yet." };
  if (!z.guid().safeParse(registrationId).success) return { ok: false, error: "We couldn't find that ticket." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to buy a ticket." };

  // 1. Ownership and amount come from the database through the user's own session.
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("registrations")
    .select(
      "id, user_id, event_id, status, amount, currency, payment_status, stripe_checkout_session_id, updated_at, " +
        "ticket_types(name), events(id, title, status, starts_at, ends_at, organiser_id)",
    )
    .eq("id", registrationId)
    .maybeSingle();
  if (error) {
    console.error("[payments] registration lookup failed", error);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
  const reg = data as unknown as RegistrationRow | null;
  const blocker = checkoutBlocker(reg, user.id);
  if (blocker || !reg) return { ok: false, error: blocker ?? "We couldn't find that ticket." };

  const event = reg.events;
  if (!event || event.status !== "published") return { ok: false, error: "This event isn't selling tickets right now." };
  if (new Date(event.ends_at ?? event.starts_at).getTime() < Date.now()) {
    return { ok: false, error: "This event has already ended." };
  }
  if (!event.organiser_id) return { ok: false, error: "This event doesn't sell tickets through ORBIT." };

  const base = await appBaseUrl();
  const successUrl = `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
  const admin = createAdminClient();

  try {
    // 2. Reuse an open checkout so a double tap can't create two payable sessions.
    if (reg.stripe_checkout_session_id) {
      const existing = await stripe.checkout.sessions.retrieve(reg.stripe_checkout_session_id).catch(() => null);
      if (existing && isReusableSession(existing)) return { ok: true, url: existing.url! };
      if (existing && existing.payment_status === "paid") {
        await fulfilCheckoutSession(existing);
        return { ok: true, url: successUrl.replace("{CHECKOUT_SESSION_ID}", existing.id) };
      }
    }

    // 3. The organiser must be able to take money.
    const { data: org } = await admin
      .from("organisers")
      .select("id, name, status, stripe_account_id, stripe_charges_enabled")
      .eq("id", event.organiser_id)
      .maybeSingle();
    if (!org || org.status !== "approved" || !isOrganiserPayable(org)) {
      return {
        ok: false,
        error: "This organiser hasn't finished setting up payments yet, so tickets can't be bought right now. Please check back soon.",
      };
    }

    // 4. The 30-minute hold must still be live — or, if it lapsed, there must still be room.
    const { data: holdOk, error: holdError } = await admin.rpc("payment_hold_ok", { p_registration_id: reg.id });
    if (holdError) throw holdError;
    if (!holdOk) return { ok: false, error: "Sorry — this event filled up while your spot was on hold." };

    const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle();
    const email = (profile?.email as string | null) ?? user.email ?? undefined;

    const amount = toPence(reg.amount);
    const fee = applicationFeePence(amount, platformFeePercent());
    const name = lineItemName(event.title, reg.ticket_types?.name);
    const metadata = { registration_id: reg.id, event_id: event.id };

    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: { currency: SUPPORTED_CURRENCY, unit_amount: amount, product_data: { name } },
          },
        ],
        customer_email: email,
        client_reference_id: reg.id,
        metadata,
        payment_intent_data: {
          description: name,
          metadata,
          transfer_data: { destination: org.stripe_account_id as string },
          ...(fee > 0 ? { application_fee_amount: fee } : {}),
        },
        expires_at: checkoutExpiresAt(),
        locale: "en-GB",
        success_url: successUrl,
        cancel_url: `${base}/events/${event.id}`,
      },
      // Concurrent taps on the same registration state get the same session back.
      { idempotencyKey: `orbit-checkout-${reg.id}-${reg.stripe_checkout_session_id ?? "new"}-${reg.updated_at}` },
    );
    if (!session.url) throw new Error(`Checkout session ${session.id} has no URL`);

    // 5. Remember the session on the registration (this also refreshes the hold).
    const { error: saveError } = await admin
      .from("registrations")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", reg.id)
      .eq("status", "awaiting_payment");
    if (saveError) throw saveError;

    return { ok: true, url: session.url };
  } catch (e) {
    return { ok: false, error: describeStripeError(e, "We couldn't start the payment. Please try again.") };
  }
}
