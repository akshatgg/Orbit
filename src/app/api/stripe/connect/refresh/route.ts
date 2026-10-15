import { NextResponse, type NextRequest } from "next/server";
import { createOnboardingLink, getOwnedOrganiser, paymentsPageUrl } from "@/lib/payments/connect";
import { appBaseUrl, getStripe } from "@/lib/payments/stripe";

// Stripe sends organisers here when an onboarding link has expired or was already used.
// We mint a fresh link for an account that already exists (never create accounts on a GET).
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org") ?? "";
  const base = await appBaseUrl();
  const back = (extra = "") => NextResponse.redirect(paymentsPageUrl(base, orgId, extra));

  const org = orgId ? await getOwnedOrganiser(orgId) : null;
  if (!getStripe() || !org?.stripe_account_id) return back();

  try {
    return NextResponse.redirect(await createOnboardingLink(org.id, org.stripe_account_id));
  } catch (error) {
    console.error("[payments] couldn't refresh onboarding link", error);
    return back("&error=link");
  }
}
