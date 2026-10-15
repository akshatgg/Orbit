import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * JSON-only, same-origin, signed-in. Requiring `application/json` means a cross-site form can't
 * post here (browsers preflight JSON requests from other origins, and we never allow them).
 */
export async function authorise(request: NextRequest) {
  const type = request.headers.get("content-type") ?? "";
  const origin = request.headers.get("origin");
  if (!type.includes("application/json") || (origin && origin !== request.nextUrl.origin)) {
    return { error: NextResponse.json({ error: "Bad request" }, { status: 400 }) } as const;
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) {
    return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) } as const;
  }
  return { supabase, userId } as const;
}
