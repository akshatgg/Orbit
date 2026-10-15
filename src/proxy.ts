import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Skip static files, icons, the service worker and the manifest.
  matcher: [
    "/((?!_next/static|_next/image|icons/|brand/|sw\\.js|manifest\\.webmanifest|icon\\.png|apple-icon\\.png|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
