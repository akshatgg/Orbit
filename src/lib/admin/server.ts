import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type { ActionResult } from "./types";

export type { ActionResult };

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Every admin action starts here: re-checks the caller is an admin, returns their RLS client. */
export async function adminContext() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  return { profile, supabase };
}

export type AuditTarget = "organiser" | "event" | "user" | "category" | "import";

/** Appends to admin_audit_log. Never throws — a missing log line mustn't undo an action. */
export async function logAdminAction(
  supabase: Supabase,
  action: string,
  targetType: AuditTarget,
  targetId: string | null,
  details: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc("log_admin_action", {
    p_action: action,
    p_target_type: targetType,
    p_target_id: targetId,
    p_details: details,
  });
  if (error) console.error("[admin] audit log failed", action, error.message);
}

/** Admin pages and every public list that shows events/organisers. */
export function revalidateEverywhere() {
  revalidatePath("/", "layout");
}

/** Turns Postgres errors into something an admin can act on. */
export function friendlyDbError(error: { message: string; code?: string } | null, fallback = "Something went wrong") {
  if (!error) return fallback;
  if (error.code === "23505") return "That already exists";
  if (error.code === "42501") return "You don't have permission to do that";
  return error.message || fallback;
}
