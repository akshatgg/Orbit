"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { apiMessage, isSignedOut } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import type { PayoutActionState } from "@/components/payments/PayoutActionForm";

// Stripe Connect lives in the Orbit API (`/payments/connect/*`); it checks the caller owns the
// organiser and creates the Express account, onboarding links and dashboard links.

const orgIdSchema = z.guid();

/** API error codes → the payouts page copy. */
const PAYOUT_ERRORS: Record<string, string> = {
  payments_not_configured: "Payments aren't switched on for ORBIT yet.",
  organiser_not_approved: "You can set up payouts once ORBIT has approved your organiser.",
  organiser_not_found: "Choose an organiser first.",
  not_connected: "Set up payouts first.",
  stripe_auth: "ORBIT's Stripe keys look wrong — please let the ORBIT team know.",
  stripe_unreachable: "We couldn't reach Stripe. Please try again in a minute.",
  stripe_busy: "Stripe is busy right now. Please try again in a minute.",
  "Only the owner can do that": "Only the organiser's owner can manage payouts.",
  "Not a member of this organiser": "Only the organiser's owner can manage payouts.",
};

async function payoutLink(path: string, formData: FormData, fallback: string): Promise<PayoutActionState> {
  const parsed = orgIdSchema.safeParse(formData.get("org"));
  if (!parsed.success) return { ok: false, error: "Choose an organiser first." };

  let url: string;
  try {
    ({ url } = await authed.post<{ url: string }>(path, { body: { organiser_id: parsed.data } }));
  } catch (error) {
    if (isSignedOut(error)) return { ok: false, error: "Please sign in again." };
    return { ok: false, error: apiMessage(error, PAYOUT_ERRORS, { fallback }) };
  }
  redirect(url);
}

/** "Set up payouts with Stripe" / "Continue setup": create the Express account if needed, then go to Stripe. */
export async function startPayoutSetup(_prev: PayoutActionState, formData: FormData): Promise<PayoutActionState> {
  return payoutLink("/payments/connect/onboarding", formData, "We couldn't start Stripe setup. Please try again.");
}

/** "Open Stripe dashboard": login links are single-use, so mint one per click. */
export async function openStripeDashboard(_prev: PayoutActionState, formData: FormData): Promise<PayoutActionState> {
  return payoutLink("/payments/connect/dashboard", formData, "We couldn't open your Stripe dashboard. Please try again.");
}
