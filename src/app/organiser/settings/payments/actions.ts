"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createOnboardingLink, ensureConnectedAccount, getOwnedOrganiser } from "@/lib/payments/connect";
import { describeStripeError, getStripe } from "@/lib/payments/stripe";
import type { PayoutActionState } from "@/components/payments/PayoutActionForm";

const orgIdSchema = z.guid();

async function ownedOrgFrom(formData: FormData) {
  const parsed = orgIdSchema.safeParse(formData.get("org"));
  if (!parsed.success) return { error: "Choose an organiser first." } as const;
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in again." } as const;
  const org = await getOwnedOrganiser(parsed.data);
  if (!org) return { error: "Only the organiser's owner can manage payouts." } as const;
  return { org, user } as const;
}

/** "Set up payouts with Stripe" / "Continue setup": create the Express account if needed, then go to Stripe. */
export async function startPayoutSetup(_prev: PayoutActionState, formData: FormData): Promise<PayoutActionState> {
  if (!getStripe()) return { ok: false, error: "Payments aren't switched on for ORBIT yet." };
  const result = await ownedOrgFrom(formData);
  if ("error" in result) return { ok: false, error: result.error };
  const { org, user } = result;
  if (org.status !== "approved") {
    return { ok: false, error: "You can set up payouts once ORBIT has approved your organiser." };
  }

  let url: string;
  try {
    const accountId = await ensureConnectedAccount(org, user.email);
    url = await createOnboardingLink(org.id, accountId);
  } catch (error) {
    return { ok: false, error: describeStripeError(error, "We couldn't start Stripe setup. Please try again.") };
  }
  redirect(url);
}

/** "Open Stripe dashboard": login links are single-use, so mint one per click. */
export async function openStripeDashboard(_prev: PayoutActionState, formData: FormData): Promise<PayoutActionState> {
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Payments aren't switched on for ORBIT yet." };
  const result = await ownedOrgFrom(formData);
  if ("error" in result) return { ok: false, error: result.error };
  const accountId = result.org.stripe_account_id;
  if (!accountId) return { ok: false, error: "Set up payouts first." };

  let url: string;
  try {
    url = (await stripe.accounts.createLoginLink(accountId)).url;
  } catch (error) {
    return { ok: false, error: describeStripeError(error, "We couldn't open your Stripe dashboard. Please try again.") };
  }
  redirect(url);
}
