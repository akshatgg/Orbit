"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_PREFERENCES, type Preferences } from "./plan";

// Reminder preferences, read/written with the user's own session (RLS: own row only).

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

async function session() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  return { supabase, userId };
}

export async function getNotificationPreferences(): Promise<Result<Preferences>> {
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "Sign in to manage notifications" };
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("push_enabled, email_enabled, remind_before_hours, deadline_reminders")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { ok: false, error: "Couldn't load your settings" };
  return { ok: true, data: (data as Preferences | null) ?? DEFAULT_PREFERENCES };
}

const preferencesSchema = z.object({
  push_enabled: z.boolean(),
  email_enabled: z.boolean(),
  remind_before_hours: z.union([z.literal(2), z.literal(24)]),
  deadline_reminders: z.boolean(),
});

export async function saveNotificationPreferences(input: Preferences): Promise<Result<Preferences>> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid settings" };
  const { supabase, userId } = await session();
  if (!userId) return { ok: false, error: "Sign in to manage notifications" };
  const { error } = await supabase
    .from("notification_preferences")
    .upsert({ user_id: userId, ...parsed.data }, { onConflict: "user_id" });
  if (error) {
    console.error("[notifications] save preferences failed", error.message);
    return { ok: false, error: "Couldn't save your settings" };
  }
  return { ok: true, data: parsed.data };
}
