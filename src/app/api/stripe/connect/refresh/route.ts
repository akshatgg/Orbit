import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { authed } from "@/lib/api/session";

// An organiser whose Stripe onboarding link expired or was already used lands here. The Orbit API
// answers with a 303 to a fresh Stripe link (or back to the payments page); it never creates accounts.
export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("org") ?? "";
  const back = (extra = "") =>
    NextResponse.redirect(new URL(`/organiser/settings/payments?org=${encodeURIComponent(orgId)}${extra}`, request.url));
  if (!z.guid().safeParse(orgId).success) return back();

  try {
    const response = await authed.raw("/payments/connect/refresh", {
      query: { organiser_id: orgId },
      redirect: "manual",
    });
    const location = response.headers.get("location");
    return location ? NextResponse.redirect(location, 303) : back();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) {
      return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.url));
    }
    return back(error.status >= 500 || error.status === 0 ? "&error=link" : "");
  }
}
