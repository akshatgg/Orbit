"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apiMessage, isConflict, isSignedOut } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { getCurrentUser } from "@/lib/auth";
import { fieldErrors, organiserApplicationSchema, organiserProfileSchema, teamMemberSchema, type FieldErrors } from "./schemas";
import { isValidInviteCode } from "./invites";
import { isValidSlug } from "./slug";

export type FormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: FieldErrors } | null;

const SIGNED_OUT = "Your session has ended. Sign in again to continue.";
const SLUG_TAKEN: FormState = { error: "That link is taken.", fieldErrors: { slug: "Someone already uses this link — try another" } };

/** A failed API call as form copy: the API's own sentence when it wrote one, else `fallback`. */
function failure(error: unknown, fallback: string, copy: Record<string, string> = {}) {
  if (isSignedOut(error)) return SIGNED_OUT;
  return apiMessage(error, copy, { fallback, passThrough: true });
}

const entries = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));

/** Live check while typing a slug. Pending organisers count too. */
export async function checkSlugAvailable(slug: string): Promise<{ valid: boolean; available: boolean }> {
  const s = slug.trim().toLowerCase();
  if (!isValidSlug(s)) return { valid: false, available: false };
  try {
    const { available } = await authed.get<{ available: boolean }>("/organisers/slug-available", { query: { slug: s } });
    return { valid: true, available };
  } catch {
    return { valid: true, available: false };
  }
}

/** "Become an organiser" — the API makes it pending and the applicant its owner. */
export async function applyAsOrganiser(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: SIGNED_OUT };

  const parsed = organiserApplicationSchema.safeParse(entries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const v = parsed.data;

  const { available } = await checkSlugAvailable(v.slug);
  if (!available) return SLUG_TAKEN;

  let id: string;
  try {
    const org = await authed.post<{ id: string }>("/organisers", {
      body: {
        name: v.name, slug: v.slug, kind: v.kind, university: v.university || null, bio: v.bio || null,
        website: v.website || null, contact_email: v.contact_email, logo_url: v.logo_url || null,
      },
    });
    id = org.id;
  } catch (error) {
    if (isConflict(error)) return SLUG_TAKEN;
    return { error: failure(error, "We couldn't send your application. Please try again.") };
  }

  revalidatePath("/organiser", "layout");
  redirect(`/organiser?org=${id}&applied=1`);
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

  let slug: string;
  try {
    const org = await authed.patch<{ slug: string }>(`/organisers/${orgId.data}`, {
      body: {
        name: v.name, bio: v.bio || null, website: v.website || null, contact_email: v.contact_email,
        logo_url: v.logo_url || null, university: v.university || null,
      },
    });
    slug = org.slug;
  } catch (error) {
    return {
      error: failure(error, "We couldn't save your changes. Please try again.", {
        "Not a member of this organiser": "Only members of this organiser can edit it.",
      }),
    };
  }

  revalidatePath("/organiser", "layout");
  revalidatePath(`/o/${slug}`);
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

  try {
    await authed.post(`/organisers/${orgId.data}/members`, { body: { email: parsed.data.email, role: parsed.data.role } });
  } catch (error) {
    return { error: failure(error, "We couldn't add them. Please try again.") };
  }

  revalidatePath("/organiser/settings");
  return { ok: true, message: `${parsed.data.email} added to the team` };
}

export async function removeTeamMember(organiserId: string, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = z.object({ org: z.uuid(), member: z.uuid() }).safeParse({ org: organiserId, member: userId });
  if (!ids.success) return { ok: false, error: "Team member not found." };

  try {
    await authed.del(`/organisers/${ids.data.org}/members/${ids.data.member}`);
  } catch (error) {
    return { ok: false, error: failure(error, "We couldn't remove them. Please try again.") };
  }

  revalidatePath("/organiser", "layout");
  return { ok: true };
}

/** Owner creates a team invite link (the organisation must be approved; the API checks). */
export async function createTeamInvite(organiserId: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const id = z.uuid().safeParse(organiserId);
  if (!id.success) return { ok: false, error: "Organiser not found." };

  let code: string;
  try {
    ({ code } = await authed.post<{ code: string }>(`/organisers/${id.data}/invites`));
  } catch (error) {
    return { ok: false, error: failure(error, "We couldn't create the link. Please try again.") };
  }

  revalidatePath("/organiser/settings");
  return { ok: true, code };
}

/** Owner turns an invite link off. */
export async function revokeTeamInvite(inviteId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = z.uuid().safeParse(inviteId);
  if (!id.success) return { ok: false, error: "Invite not found." };

  try {
    await authed.del(`/organisers/invites/${id.data}`);
  } catch (error) {
    return {
      ok: false,
      error: failure(error, "We couldn't turn the link off. Please try again.", {
        "Only the owner can do that": "Only owners can turn off invite links.",
        "Not a member of this organiser": "Only owners can turn off invite links.",
      }),
    };
  }

  revalidatePath("/organiser/settings");
  return { ok: true };
}

/** Signed-in person accepts an invite from /join/<code>; they become an editor and land in Studio. */
export async function acceptTeamInvite(code: string): Promise<{ ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  if (!isValidInviteCode(code)) return { ok: false, error: "This invite link is not valid" };

  let organiserId: string;
  try {
    ({ id: organiserId } = await authed.post<{ id: string }>(`/invites/${encodeURIComponent(code)}/accept`));
  } catch (error) {
    return { ok: false, error: failure(error, "We couldn't add you to the team. Please try again.") };
  }

  revalidatePath("/", "layout");
  redirect(`/organiser?org=${organiserId}&joined=1`);
}
