import "server-only";

// Paid tickets. Placeholder until the payments feature lands:
// the event page calls `createTicketCheckout` when a registration is `awaiting_payment`.

export function isPaymentsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/** Starts checkout for a registration that is awaiting payment. Returns the URL to redirect to. */
export async function createTicketCheckout(registrationId: string): Promise<CheckoutResult> {
  void registrationId;
  return { ok: false, error: "Paid tickets aren't available yet." };
}
