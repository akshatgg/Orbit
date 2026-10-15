import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Bypasses Row Level Security. Only for trusted server code
 * (cron jobs, CSV import) — never import this from a Client Component.
 */
export function createAdminClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
