import "server-only";
import Stripe from "stripe";
import { headers } from "next/headers";
import { parseFeePercent } from "./logic";

// Env-driven Stripe setup. Everything degrades to "not configured" when keys are missing.

export function isPaymentsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;

/** The platform Stripe client, or null when STRIPE_SECRET_KEY isn't set. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) {
    client = new Stripe(key, {
      maxNetworkRetries: 2,
      timeout: 20_000,
      appInfo: { name: "ORBIT", url: "https://orbit.akshatgg.in" },
    });
  }
  return client;
}

/** Signing secrets for /api/stripe/webhook (platform endpoint, plus an optional Connect endpoint). */
export function webhookSecrets(): string[] {
  return [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET]
    .flatMap((s) => (s ?? "").split(","))
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ORBIT's cut of each ticket, as a percentage (PLATFORM_FEE_PERCENT, default 0). */
export function platformFeePercent() {
  return parseFeePercent(process.env.PLATFORM_FEE_PERCENT);
}

/** Absolute base URL for Stripe redirects: NEXT_PUBLIC_APP_URL, else the current request's origin. */
export async function appBaseUrl(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

/** Short, user-safe description of a Stripe failure (details go to the server log). */
export function describeStripeError(error: unknown, fallback: string): string {
  console.error("[payments]", error);
  if (error instanceof Stripe.errors.StripeAuthenticationError) {
    return "ORBIT's Stripe keys look wrong — please let the ORBIT team know.";
  }
  if (error instanceof Stripe.errors.StripeConnectionError) {
    return "We couldn't reach Stripe. Please try again in a minute.";
  }
  if (error instanceof Stripe.errors.StripeRateLimitError) {
    return "Stripe is busy right now. Please try again in a minute.";
  }
  return fallback;
}
