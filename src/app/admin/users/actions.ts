"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminContext, friendlyDbError, logAdminAction, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";

const id = z.uuid();
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

/** Toggle the verified-student badge. RLS + guard_profile_update let admins do this. */
export async function setStudentVerified(userId: string, verified: boolean): Promise<ActionResult> {
  const { supabase } = await adminContext();
  const parsed = id.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid user" };
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_verified_student: verified === true })
    .eq("id", parsed.data)
    .select("id, email, full_name")
    .maybeSingle();
  if (error) return { ok: false, error: friendlyDbError(error) };
  if (!data) return { ok: false, error: "User not found" };
  await logAdminAction(supabase, verified ? "user.verify_student" : "user.unverify_student", "user", data.id, {
    name: data.full_name ?? data.email, email: data.email,
  });
  revalidateEverywhere();
  return { ok: true, message: verified ? "Marked as verified student" : "Removed verified student badge" };
}

export type AdminFormState = { ok?: boolean; error?: string; message?: string } | null;

async function changeRole(rawEmail: string, role: "admin" | "user"): Promise<ActionResult> {
  await requireSuperAdmin(); // redirects non-super-admins; the RPC checks again in SQL
  const parsed = email.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_user_role", { target_email: parsed.data, new_role: role });
  if (error) return { ok: false, error: error.message };
  await logAdminAction(supabase, role === "admin" ? "user.add_admin" : "user.remove_admin", "user", (data as string) ?? null, {
    email: parsed.data,
  });
  revalidateEverywhere();
  return { ok: true, message: role === "admin" ? `${parsed.data} is now an admin` : `${parsed.data} is no longer an admin` };
}

/** Add-admin form (useActionState). */
export async function addAdmin(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  const r = await changeRole(String(formData.get("email") ?? ""), "admin");
  return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error };
}

export async function removeAdmin(targetEmail: string): Promise<ActionResult> {
  return changeRole(targetEmail, "user");
}
