"use server";

import { z } from "zod";
import { ApiError } from "@/lib/api/client";
import { apiAs, authed } from "@/lib/api/session";
import { DEFAULT_PREFERENCES, type Preferences } from "./preferences";

// Reminder preferences, read and written as the signed-in user through the Orbit API.

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const preferencesSchema = z.object({
  push_enabled: z.boolean(),
  email_enabled: z.boolean(),
  remind_before_hours: z.union([z.literal(2), z.literal(24)]),
  deadline_reminders: z.boolean(),
});

function pick(prefs: Preferences): Preferences {
  const { push_enabled, email_enabled, remind_before_hours, deadline_reminders } = prefs;
  return { push_enabled, email_enabled, remind_before_hours, deadline_reminders };
}

export async function getNotificationPreferences(): Promise<Result<Preferences>> {
  try {
    const prefs = await apiAs<Preferences>("/me/notification-preferences");
    if (!prefs) return { ok: false, error: "Sign in to manage notifications" };
    return { ok: true, data: { ...DEFAULT_PREFERENCES, ...pick(prefs) } };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ok: false, error: "Couldn't load your settings" };
  }
}

export async function saveNotificationPreferences(input: Preferences): Promise<Result<Preferences>> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid settings" };
  try {
    const saved = await authed.put<Preferences>("/me/notification-preferences", { body: parsed.data });
    return { ok: true, data: pick(saved) };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 401) return { ok: false, error: "Sign in to manage notifications" };
    console.error("[notifications] save preferences failed", error.status, error.message);
    return { ok: false, error: "Couldn't save your settings" };
  }
}
