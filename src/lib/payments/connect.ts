import "server-only";
import type Stripe from "stripe";
import { getMyOrganisers, type MyOrganiser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { appBaseUrl, getStripe } from "./stripe";

// Stripe Connect (Express) onboarding for organisers.
// Only the organiser's owner may start onboarding; only this server code writes the Stripe fields
// (the database ignores them from user sessions), always through the admin client.

/** Organisers the signed-in user owns (owners manage payouts; editors can't). */
export async function getOwnedOrganisers(): Promise<MyOrganiser[]> {
  const orgs = await getMyOrganisers();
  return orgs.filter((o) => o.member_role === "owner");
}

/** The organiser if the signed-in user owns it, else null. */
export async function getOwnedOrganiser(orgId: string): Promise<MyOrganiser | null> {
  const owned = await getOwnedOrganisers();
  return owned.find((o) => o.id === orgId) ?? null;
}

export function paymentsPageUrl(base: string, orgId: string, extra = "") {
  return `${base}/organiser/settings/payments?org=${encodeURIComponent(orgId)}${extra}`;
}

function httpUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Returns the organiser's connected account id, creating an Express account (GB) the first time.
 * The id is stored with the admin client — the only way it can be written.
 */
export async function ensureConnectedAccount(org: MyOrganiser, fallbackEmail: string | null): Promise<string> {
  if (org.stripe_account_id) return org.stripe_account_id;
  const stripe = getStripe();
  if (!stripe) throw new Error("Payments are not configured");

  const email = org.contact_email || fallbackEmail || undefined;
  const account = await stripe.accounts.create(
    {
      type: "express",
      country: "GB",
      default_currency: "gbp",
      email,
      business_profile: {
        name: org.name,
        url: httpUrl(org.website),
        support_email: org.contact_email || undefined,
        product_description: org.bio?.slice(0, 500) || `Event tickets sold on ORBIT by ${org.name}`,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: { organiser_id: org.id, organiser_slug: org.slug },
    },
    // A double-click shouldn't create two accounts.
    { idempotencyKey: `orbit-connect-account-${org.id}` },
  );

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organisers")
    .update({ stripe_account_id: account.id, stripe_charges_enabled: account.charges_enabled })
    .eq("id", org.id)
    .is("stripe_account_id", null)
    .select("stripe_account_id");
  if (error) throw error;
  if (data && data.length > 0) return account.id;

  // Someone else stored an account first — use theirs.
  const { data: current, error: readError } = await admin
    .from("organisers")
    .select("stripe_account_id")
    .eq("id", org.id)
    .single();
  if (readError || !current?.stripe_account_id) throw readError ?? new Error("Couldn't save the Stripe account");
  return current.stripe_account_id as string;
}

/** A one-time Stripe-hosted onboarding link for the account. */
export async function createOnboardingLink(orgId: string, accountId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error("Payments are not configured");
  const base = await appBaseUrl();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${base}/api/stripe/connect/refresh?org=${encodeURIComponent(orgId)}`,
    return_url: paymentsPageUrl(base, orgId, "&from=stripe"),
  });
  return link.url;
}

export type AccountSummary = {
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  dueCount: number;
  disabledReason: string | null;
};

export function summariseAccount(account: Stripe.Account): AccountSummary {
  return {
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    dueCount: account.requirements?.currently_due?.length ?? 0,
    disabledReason: account.requirements?.disabled_reason ?? null,
  };
}

/** Copies `charges_enabled` from Stripe onto every organiser using this account. */
export async function syncAccountStatus(account: Pick<Stripe.Account, "id" | "charges_enabled">) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("organisers")
    .update({ stripe_charges_enabled: account.charges_enabled })
    .eq("stripe_account_id", account.id)
    .neq("stripe_charges_enabled", account.charges_enabled);
  if (error) throw error;
}

/** Fetches the live account from Stripe and syncs our copy. Null if Stripe can't be reached. */
export async function refreshAccount(accountId: string): Promise<AccountSummary | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    await syncAccountStatus(account);
    return summariseAccount(account);
  } catch (error) {
    console.error("[payments] couldn't refresh account", accountId, error);
    return null;
  }
}
