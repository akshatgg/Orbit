import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./env";

/** Supabase client for Client Components. */
export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
