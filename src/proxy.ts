import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/api/session-cookie";

// Reachable without signing in. Event and organiser pages are public so they can be shared.
const PUBLIC_PATHS = [
  "/welcome", "/robots.txt", "/sitemap.xml", "/opengraph-image", "/twitter-image",
  "/login", "/auth", "/offline", "/events/", "/o/", "/go/", "/api/cron/",
];

/**
 * Session gate.
 *
 * The cookie is a backend-issued JWT; it is not verified here (that would mean
 * a network call on every navigation). This only decides which pages a visitor
 * may open — the backend rejects a bad token on every data call regardless.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signedIn = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // Signed-out visitors get the public landing page at "/" (served from /welcome, URL unchanged).
  if (!signedIn && pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/welcome";
    return NextResponse.rewrite(url);
  }

  if (!signedIn && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (signedIn && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

export const config = {
  // Skip static files, icons, the service worker and the manifest.
  matcher: [
    "/((?!_next/static|_next/image|icons/|brand/|sw\\.js|manifest\\.webmanifest|icon\\.png|apple-icon\\.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
