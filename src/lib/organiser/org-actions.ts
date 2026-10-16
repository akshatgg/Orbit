"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, organiserApplicationSchema, organiserProfileSchema, teamMemberSchema, type FieldErrors } from "./schemas";
import { isValidInviteCode } from "./invites";
import { isValidSlug } from "./slug";

export type FormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: FieldErrors } | null;

const SIGNED_OUT = "Your session has ended. Sign in again to continue.";

/** Postgres exception text without the "ERROR: " noise, or a friendly fallback. */
function dbMessage(error: { message?: string } | null, fallback: string) {
  const msg = error?.message?.trim();
  if (!msg || /permission denied|row-level security|violates/i.test(msg)) return fallback;
  return msg;
}

const entries = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));

/** Live check while typing a slug. Pending organisers are counted too (RLS hides them otherwise). */
export async function checkSlugAvailable(slug: string): Promise<{ valid: boolean; available: boolean }> {
  const s = slug.trim().toLowerCase();
  if (!isValidSlug(s)) return { valid: false, available: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organiser_slug_available", { p_slug: s });
  return { valid: true, available: !error && data === true };
}

/** "Become an organiser" — the database makes it pending and the applicant its owner. */
export async function applyAsOrganiser(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const parsed = organiserApplicationSchema.safeParse(entries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { available } = await checkSlugAvailable(v.slug);
  if (!available) return { error: "That link is taken.", fieldErrors: { slug: "Someone already uses this link — try another" } };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisers")
    .insert({
      name: v.name, slug: v.slug, kind: v.kind, university: v.university || null, bio: v.bio || null,
      website: v.website || null, contact_email: v.contact_email, logo_url: v.logo_url || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") return { error: "That link is taken.", fieldErrors: { slug: "Someone already uses this link — try another" } };
    return { error: dbMessage(error, "We couldn't send your application. Please try again.") };
  }

  revalidatePath("/organiser", "layout");
  redirect(`/organiser?org=${data.id}&applied=1`);
}

/** Organiser profile (name, bio, logo, website, contact email, university). Any member may edit. */
export async function updateOrganiserProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const orgId = z.uuid().safeParse(formData.get("organiser_id"));
  if (!orgId.success) return { error: "Organiser not found." };

  const parsed = organiserProfileSchema.safeParse(entries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organisers")
    .update({
      name: v.name, bio: v.bio || null, website: v.website || null, contact_email: v.contact_email,
      logo_url: v.logo_url || null, university: v.university || null,
    })
    .eq("id", orgId.data)
    .select("slug");

  if (error) return { error: dbMessage(error, "We couldn't save your changes. Please try again.") };
  if (!data?.length) return { error: "Only members of this organiser can edit it." };

  revalidatePath("/organiser", "layout");
  revalidatePath(`/o/${data[0].slug}`);
  return { ok: true, message: "Profile saved" };
}

/** Owner adds a team member by email (they must have signed in to ORBIT once). */
export async function addTeamMember(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const orgId = z.uuid().safeParse(formData.get("organiser_id"));
  if (!orgId.success) return { error: "Organiser not found." };
  const parsed = teamMemberSchema.safeParse(entries(formData));
  if (!parsed.success) return { error: "Check the email address.", fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_organiser_member", {
    org: orgId.data, member_email: parsed.data.email, member_role: parsed.data.role,
  });
  if (error) return { error: dbMessage(error, "We couldn't add them. Please try again.") };

  revalidatePath("/organiser/settings");
  return { ok: true, message: `${parsed.data.email} added to the team` };
}

export async function removeTeamMember(organiserId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const ids = z.object({ org: z.uuid(), member: z.uuid() }).safeParse({ org: organiserId, member: userId });
  if (!ids.success) return { ok: false, error: "Team member not found." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_organiser_member", ids.data);
  if (error) return { ok: false, error: dbMessage(error, "We couldn't remove them. Please try again.") };

  revalidatePath("/organiser", "layout");
  return { ok: true };
}

/** Owner creates a team invite link (the organisation must be approved; the database checks). */
export async function createTeamInvite(organiserId: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const id = z.uuid().safeParse(organiserId);
  if (!id.success) return { ok: false, error: "Organiser not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organiser_invite", { org: id.data });
  if (error || typeof data !== "string") return { ok: false, error: dbMessage(error, "We couldn't create the link. Please try again.") };

  revalidatePath("/organiser/settings");
  return { ok: true, code: data };
}

/** Owner turns an invite link off. */
export async function revokeTeamInvite(inviteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: SIGNED_OUT };
  const id = z.uuid().safeParse(inviteId);
  if (!id.success) return { ok: false, error: "Invite not found." };

  const supabase = await createClient();
  const { data, error } = await supabase.from("organiser_invites").update({ revoked: true }).eq("id", id.data).select("id");
  if (error) return { ok: false, error: dbMessage(error, "We couldn't turn the link off. Please try again.") };
  if (!data?.length) return { ok: false, error: "Only owners can turn off invite links." };

  revalidatePath("/organiser/settings");
  return { ok: true };
}

/** Signed-in person accepts an invite from /join/<code>; they become an editor and land in Studio. */
export async function acceptTeamInvite(code: string): Promise<{ ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  if (!isValidInviteCode(code)) return { ok: false, error: "This invite link is not valid" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_organiser_invite", { p_code: code });
  if (error || !data) return { ok: false, error: dbMessage(error, "We couldn't add you to the team. Please try again.") };

  revalidatePath("/", "layout");
  redirect(`/organiser?org=${(data as { id: string }).id}&joined=1`);
}
