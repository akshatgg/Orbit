// Pure payment helpers (no Stripe / Supabase calls) — unit tested in logic.test.ts.

/** Paid spots are held for 30 minutes (see taken_spots in the registrations migration). */
export const HOLD_MINUTES = 30;

/**
 * Stripe needs a Checkout Session to live at least 30 minutes, measured from its own clock,
 * so we add a minute of slack. The hold refreshes when we store the session id, so the two
 * end within a minute of each other.
 */
export const CHECKOUT_MINUTES = HOLD_MINUTES + 1;

export const SUPPORTED_CURRENCY = "gbp";

/** £12.50 → 1250. Accepts numbers or numeric strings (Postgres numeric). Never negative. */
export function toPence(amount: number | string | null | undefined): number {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount ?? 0;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

/** PLATFORM_FEE_PERCENT → a number between 0 and 100 (anything invalid is 0). */
export function parseFeePercent(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || raw.trim() === "") return 0;
  const n = Number(raw.trim().replace(/%$/, ""));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 100);
}

/** ORBIT's cut of a ticket, in pence, rounded to the nearest penny and never more than the price. */
export function applicationFeePence(amountPence: number, percent: number): number {
  if (amountPence <= 0 || percent <= 0) return 0;
  return Math.min(amountPence, Math.round((amountPence * percent) / 100));
}

/** "Founders Friday — Student" (ticket name optional). Stripe caps product names, so we trim. */
export function lineItemName(eventTitle: string, ticketName?: string | null): string {
  const name = ticketName?.trim() ? `${eventTitle.trim()} — ${ticketName.trim()}` : eventTitle.trim();
  return name.length > 250 ? `${name.slice(0, 249)}…` : name;
}

/** Unix seconds when a Checkout Session created now should expire. */
export function checkoutExpiresAt(nowMs: number = Date.now()): number {
  return Math.floor(nowMs / 1000) + CHECKOUT_MINUTES * 60;
}

/** True while a stored session can still be reused (open, with a couple of minutes to spare). */
export function isReusableSession(
  session: { status: string | null; expires_at: number; url: string | null },
  nowMs: number = Date.now(),
): boolean {
  return session.status === "open" && Boolean(session.url) && session.expires_at * 1000 - nowMs > 2 * 60 * 1000;
}

export type RegistrationForCheckout = {
  user_id: string;
  status: string;
  amount: number | string;
  currency: string;
  payment_status: string;
};

/** Why a registration can't go to checkout, or null when it can. */
export function checkoutBlocker(reg: RegistrationForCheckout | null, userId: string): string | null {
  if (!reg || reg.user_id !== userId) return "We couldn't find that ticket.";
  if (reg.payment_status === "paid") return "You've already paid for this ticket.";
  if (reg.status !== "awaiting_payment") {
    if (reg.status === "going") return "You've already got a ticket for this event.";
    if (reg.status === "pending") return "The organiser needs to approve you before you can pay.";
    if (reg.status === "waitlisted") return "You're on the waitlist — we'll let you know if a spot opens up.";
    return "This ticket isn't waiting for payment.";
  }
  if (toPence(reg.amount) <= 0) return "This ticket is free — no payment needed.";
  if (reg.currency.toLowerCase() !== SUPPORTED_CURRENCY) return "Only tickets priced in pounds (GBP) can be paid for right now.";
  return null;
}

export type ConnectState = "unconfigured" | "not_connected" | "incomplete" | "connected";

/** Where an organiser is with Stripe payouts. */
export function connectState(input: {
  configured: boolean;
  accountId: string | null | undefined;
  chargesEnabled: boolean | null | undefined;
}): ConnectState {
  if (!input.configured) return "unconfigured";
  if (!input.accountId) return "not_connected";
  return input.chargesEnabled ? "connected" : "incomplete";
}

/** Can this organiser take money right now? */
export function isOrganiserPayable(org: { stripe_account_id: string | null; stripe_charges_enabled: boolean } | null) {
  return Boolean(org?.stripe_account_id && org.stripe_charges_enabled);
}

export type CheckoutOutcome = "paid" | "processing" | "open" | "expired";

/** Maps a Checkout Session's status/payment_status to what we show the buyer. */
export function checkoutOutcome(session: { status: string | null; payment_status: string }): CheckoutOutcome {
  if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
    // A complete session with a paid status is final; an "open" one can't be paid yet.
    return session.status === "open" ? "open" : "paid";
  }
  if (session.status === "complete") return "processing"; // e.g. bank payments still clearing
  if (session.status === "expired") return "expired";
  return "open";
}

/** Should a checkout.session.* webhook mark the registration as paid? */
export function shouldFulfil(session: { payment_status: string; metadata?: Record<string, string> | null }): boolean {
  return session.payment_status === "paid" && Boolean(session.metadata?.registration_id);
}
