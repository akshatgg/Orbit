export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/** False until the Supabase keys are pasted into .env.local. */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabasePublishableKey,
);
