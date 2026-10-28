"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { slugify } from "@/lib/admin/category";
import { adminContext, adminError, revalidateEverywhere, type ActionResult } from "@/lib/admin/server";
import { isConflict } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";

export type CommunityFormState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
} | null;

const blank = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

const communitySchema = z.object({
  name: z.preprocess((v) => String(v ?? "").trim(), z.string().min(2, "At least 2 characters").max(60, "Keep it under 60 characters")),
  slug: z.preprocess(
    (v) => (blank(v) ? slugify(String(v)) : undefined),
    z.string().min(2, "At least 2 characters").max(60).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens").optional(),
  ),
  description: z.preprocess((v) => String(v ?? "").trim(), z.string().max(500, "Keep it under 500 characters")),
  category_id: z.preprocess(blank, z.string().max(80).optional()),
  university: z.preprocess((v) => String(v ?? "").trim(), z.string().max(120, "Keep it under 120 characters")),
  visibility: z.enum(["public", "approval", "private"], { error: "Pick who can join" }),
  allow_member_shares: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  cover_url: z.preprocess(blank, z.url({ protocol: /^https$/, error: "Use an https:// image link" }).max(1000).optional()),
});

const id = z.string().regex(/^[\w-]{1,120}$/);

/** Create (groupId null) or update a community. Bound with the id, used with useActionState. */
export async function saveCommunity(groupId: string | null, _prev: CommunityFormState, formData: FormData): Promise<CommunityFormState> {
  await adminContext();
  const raw = Object.fromEntries(formData);
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  const parsed = communitySchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields", fieldErrors, values };
  }
  if (groupId && !id.safeParse(groupId).success) return { error: "Invalid community" };
  const { description, university, category_id, cover_url, ...rest } = parsed.data;
  // Blank fields clear the value on an update; on create they're simply left out.
  const clear = (v: string | undefined) => v || (groupId ? "" : undefined);
  const body = { ...rest, description: clear(description), university: clear(university), category_id: clear(category_id), cover_url: clear(cover_url) };
  let createdId: string | null = null;
  try {
    if (groupId) await authed.patch(`/groups/${encodeURIComponent(groupId)}`, { body });
    else createdId = (await authed.post<{ id: string }>("/groups", { body: { kind: "community", ...body } })).id;
  } catch (error) {
    return { error: isConflict(error) ? "That slug is already used" : adminError(error), values };
  }
  revalidateEverywhere();
  if (createdId) redirect(`/admin/communities/${createdId}?created=1`);
  return { ok: true, message: "Saved" };
}

export async function deleteCommunity(groupId: string): Promise<ActionResult> {
  await adminContext();
  if (!id.safeParse(groupId).success) return { ok: false, error: "Invalid community" };
  try {
    await authed.del(`/groups/${encodeURIComponent(groupId)}`);
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
  revalidateEverywhere();
  redirect("/admin/communities");
}

export async function answerJoinRequest(groupId: string, inviteId: string, accept: boolean): Promise<ActionResult> {
  await adminContext();
  if (!id.safeParse(groupId).success || !id.safeParse(inviteId).success) return { ok: false, error: "Invalid request" };
  try {
    await authed.post(`/groups/${encodeURIComponent(groupId)}/invites/${encodeURIComponent(inviteId)}/respond`, { body: { accept } });
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
  revalidateEverywhere();
  return { ok: true, message: accept ? "Approved" : "Declined" };
}

export async function setModerator(groupId: string, userId: string, moderator: boolean): Promise<ActionResult> {
  await adminContext();
  if (!id.safeParse(groupId).success || !id.safeParse(userId).success) return { ok: false, error: "Invalid member" };
  try {
    await authed.patch(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`, { body: { role: moderator ? "admin" : "member" } });
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
  revalidateEverywhere();
  return { ok: true, message: moderator ? "Now a moderator" : "No longer a moderator" };
}

export async function removeCommunityMember(groupId: string, userId: string): Promise<ActionResult> {
  await adminContext();
  if (!id.safeParse(groupId).success || !id.safeParse(userId).success) return { ok: false, error: "Invalid member" };
  try {
    await authed.del(`/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(userId)}`);
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }
  revalidateEverywhere();
  return { ok: true, message: "Removed" };
}
