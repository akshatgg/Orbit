"use server";

import { z } from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { authed } from "@/lib/api/session";
import { adminContext, adminError, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";

const id = z.uuid();
const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

/** Toggle the verified-student badge. */
export async function setStudentVerified(userId: string, verified: boolean): Promise<ActionResult> {
  await adminContext();
  const parsed = id.safeParse(userId);
  if (!parsed.success) return { ok: false, error: "Invalid user" };
  try {
    await authed.post(`/admin/users/${parsed.data}/verify-student`, { body: { verified: verified === true } });
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
  revalidateEverywhere();
  return { ok: true, message: verified ? "Marked as verified student" : "Removed verified student badge" };
}

export type AdminFormState = { ok?: boolean; error?: string; message?: string } | null;

async function changeRole(rawEmail: string, role: "admin" | "user"): Promise<ActionResult> {
  await requireSuperAdmin(); // redirects non-super-admins; the API checks again
  const parsed = email.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    if (role === "admin") await authed.post("/admin/admins", { body: { email: parsed.data } });
    else await authed.del(`/admin/admins/${encodeURIComponent(parsed.data)}`);
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
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
