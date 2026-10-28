import "server-only";
import { z } from "zod";
import { apiMessage } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";

// Paid tickets: the Orbit API opens (or reuses) a Stripe Checkout session for a registration that
// is awaiting payment, and confirms it from Stripe's webhook and the success page.

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

const NOT_PAYABLE_YET =
  "This organiser hasn't finished setting up payments yet, so tickets can't be bought right now. Please check back soon.";

/** The API's checkout refusals, in the words the ticket pages use. */
export const CHECKOUT_ERRORS: Record<string, string> = {
  payments_not_configured: "Paid tickets aren't available on ORBIT yet.",
  registration_not_found: "We couldn't find that ticket.",
  already_paid: "You've already paid for this ticket.",
  already_going: "You've already got a ticket for this event.",
  awaiting_approval: "The organiser needs to approve you before you can pay.",
  waitlisted: "You're on the waitlist — we'll let you know if a spot opens up.",
  not_awaiting_payment: "This ticket isn't waiting for payment.",
  free_ticket: "This ticket is free — no payment needed.",
  unsupported_currency: "Only tickets priced in pounds (GBP) can be paid for right now.",
  event_not_on_sale: "This event isn't selling tickets right now.",
  event_ended: "This event has already ended.",
  no_organiser: "This event doesn't sell tickets through ORBIT.",
  organiser_not_approved: NOT_PAYABLE_YET,
  stripe_not_ready: NOT_PAYABLE_YET,
  hold_expired: "Sorry — this event filled up while your spot was on hold.",
  stripe_auth: "ORBIT's Stripe keys look wrong — please let the ORBIT team know.",
  stripe_unreachable: "We couldn't reach Stripe. Please try again in a minute.",
  stripe_busy: "Stripe is busy right now. Please try again in a minute.",
  stripe_error: "We couldn't start the payment. Please try again.",
};

/** Starts checkout for a registration that is awaiting payment. Returns the URL to redirect to. */
export async function createTicketCheckout(registrationId: string): Promise<CheckoutResult> {
  if (!z.guid().safeParse(registrationId).success) return { ok: false, error: "We couldn't find that ticket." };
  try {
    const { checkout_url } = await authed.post<{ checkout_url: string }>(`/me/tickets/${registrationId}/checkout`);
    return { ok: true, url: checkout_url };
  } catch (error) {
    const message = apiMessage(error, CHECKOUT_ERRORS, { fallback: "We couldn't start the payment. Please try again." });
    return { ok: false, error: message === "Sign in first" ? "Sign in to buy a ticket." : message };
  }
}
