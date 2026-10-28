import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/api/session-cookie";

const EXPIRED = "Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax";

/**
 * POST from a <form action="/auth/signout" method="post"> to sign out.
 *
 * The API sets the session cookie on the shared parent domain (`.akshatgg.in`
 * when the app is orbit.akshatgg.in) so both hosts receive it. Expire that one
 * and any host-only copy; a browser ignores the domain variant where it does not apply.
 */
export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.headers.append("set-cookie", `${SESSION_COOKIE}=; ${EXPIRED}`);
  const parent = parentDomain(request.nextUrl.hostname);
  if (parent) response.headers.append("set-cookie", `${SESSION_COOKIE}=; Domain=${parent}; ${EXPIRED}`);
  return response;
}

/** `orbit.akshatgg.in` → `.akshatgg.in`; nothing for `localhost` or an IP. */
function parentDomain(hostname: string) {
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return null;
  const labels = hostname.split(".");
  return labels.length >= 3 ? `.${labels.slice(1).join(".")}` : null;
}
