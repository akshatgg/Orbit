import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { sanitizeNext } from "@/lib/auth-redirect";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  token_hash: z.string().min(1),
  type: z.enum(["email", "magiclink", "signup", "recovery", "invite", "email_change"]),
});

/**
 * Email login links land here. Verifying the token hash on the server means the link
 * works on any device, unlike the PKCE code flow in /auth/callback.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const parsed = paramsSchema.safeParse({
    token_hash: searchParams.get("token_hash"),
    type: searchParams.get("type"),
  });

  if (parsed.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp(parsed.data);
    if (!error) {
      return NextResponse.redirect(`${origin}${sanitizeNext(searchParams.get("next"), origin)}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link`);
}
