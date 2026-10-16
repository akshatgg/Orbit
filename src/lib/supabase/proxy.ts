import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./env";

// Reachable without signing in. Event and organiser pages are public so they can be shared.
const PUBLIC_PATHS = ["/welcome", "/robots.txt", "/sitemap.xml", "/opengraph-image", "/twitter-image", "/login", "/auth", "/offline", "/events/", "/o/", "/go/", "/api/cron/", "/api/stripe/webhook"];

/** Refreshes the Supabase session cookie and sends signed-out users to /login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Let the app run before the Supabase keys are added.
  if (!isSupabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Signed-out visitors get the public landing page at "/" (served from /welcome, URL unchanged).
  if (!data?.claims && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.rewrite(url, { request });
  }

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
