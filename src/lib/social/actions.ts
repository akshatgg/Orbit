"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { apiMessage, isApiStatus, type ErrorCopy } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import type { ChatMessage, GroupDetail, InterestStatus } from "@/types/social";

/**
 * Mutations for Circles, Communities, the inbox and messages. Each returns
 * `{ ok: true, … } | { ok: false, error }`; the API checks every permission.
 */

export type Result<T = object> = ({ ok: true; message?: string } & T) | { ok: false; error: string };
export type FormState = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

const enc = encodeURIComponent;
const id = z.string().trim().min(1).max(120).regex(/^[\w-]+$/);

const COPY: ErrorCopy = {
  not_a_member: "You're not a member of this group",
  group_admins_only: "Only the group's admins can do that",
  last_admin: "Make someone else an admin before you leave",
  user_not_found: "No ORBIT account uses that email yet. Send them the invite link instead.",
  already_member: "They're already in this group",
  already_invited: "They already have an invite waiting",
  invite_expired: "That invite has expired",
  blocked: "You can't message this person",
  no_shared_group: "You can only message people you share a Circle or Community with",
  rate_limited: "You're sending messages too fast. Wait a moment.",
};

function fail(error: unknown, fallback?: string): { ok: false; error: string } {
  if (isApiStatus(error, 429)) return { ok: false, error: COPY.rate_limited };
  return { ok: false, error: apiMessage(error, COPY, { passThrough: true, fallback }) };
}

function refresh() {
  revalidatePath("/", "layout");
}

// ─── groups ─────────────────────────────────────────────────────────────────

const circleSchema = z.object({
  name: z.string().trim().min(2, "Give it a name (at least 2 characters)").max(60, "Keep it under 60 characters"),
  description: z.string().trim().max(500, "Keep it under 500 characters").optional().transform((v) => v || undefined),
});

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) out[String(issue.path[0])] ??= issue.message;
  return out;
}

/** New Circle from the /circles form; opens it. */
export async function createCircle(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = circleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrors(parsed.error) };
  let group: GroupDetail;
  try {
    group = await authed.post<GroupDetail>("/groups", { body: { kind: "circle", ...parsed.data } });
  } catch (error) {
    return fail(error, "Couldn't create the circle");
  }
  refresh();
  redirect(`/circles/${group.id}`);
}

/** New Circle from the share sheet: returns it so the sheet can tick it. */
export async function createCircleQuick(name: string): Promise<Result<{ group: { id: string; name: string } }>> {
  const parsed = circleSchema.shape.name.safeParse(name);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Give it a name" };
  try {
    const group = await authed.post<GroupDetail>("/groups", { body: { kind: "circle", name: parsed.data } });
    refresh();
    return { ok: true, group: { id: group.id, name: group.name } };
  } catch (error) {
    return fail(error, "Couldn't create the circle");
  }
}

/** Rename / re-describe a Circle (its admins). */
export async function updateCircle(groupId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!id.safeParse(groupId).success) return { error: "Invalid circle" };
  const parsed = circleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Check the highlighted fields", fieldErrors: fieldErrors(parsed.error) };
  try {
    await authed.patch(`/groups/${enc(groupId)}`, {
      body: { name: parsed.data.name, description: parsed.data.description ?? "" },
    });
  } catch (error) {
    return fail(error, "Couldn't save the changes");
  }
  refresh();
  return { ok: true, message: "Saved" };
}

export async function deleteGroup(groupId: string, next = "/circles"): Promise<Result> {
  if (!id.safeParse(groupId).success) return { ok: false, error: "Invalid group" };
  try {
    await authed.del(`/groups/${enc(groupId)}`);
  } catch (error) {
    return fail(error, "Couldn't delete it");
  }
  refresh();
  redirect(next);
}

export async function leaveGroup(groupId: string, next?: string): Promise<Result> {
  if (!id.safeParse(groupId).success) return { ok: false, error: "Invalid group" };
  try {
    await authed.post(`/groups/${enc(groupId)}/leave`);
  } catch (error) {
    return fail(error, "Couldn't leave");
  }
  refresh();
  if (next) redirect(next);
  return { ok: true, message: "You left" };
}

/** Join a public community, or ask to join an approval one. */
export async function joinGroup(groupId: string): Promise<Result<{ status: "joined" | "requested" }>> {
  if (!id.safeParse(groupId).success) return { ok: false, error: "Invalid community" };
  try {
    const res = await authed.post<{ status: string }>(`/groups/${enc(groupId)}/join`);
    refresh();
    const status = res?.status === "requested" || res?.status === "pending" ? "requested" : "joined";
    return { ok: true, status };
  } catch (error) {
    return fail(error, "Couldn't join");
  }
}

const emailSchema = z.object({ email: z.email("Enter an email address").max(200) });

export async function inviteByEmail(groupId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!id.safeParse(groupId).success) return { error: "Invalid group" };
  const parsed = emailSchema.safeParse({ email: String(formData.get("email") ?? "").trim().toLowerCase() });
  if (!parsed.success) return { error: "Enter an email address", fieldErrors: fieldErrors(parsed.error) };
  try {
    await authed.post(`/groups/${enc(groupId)}/invites`, { body: { email: parsed.data.email } });
  } catch (error) {
    if (isApiStatus(error, 404)) return { error: COPY.user_not_found };
    if (isApiStatus(error, 409)) return { error: apiMessage(error, COPY, { passThrough: true, fallback: COPY.already_invited }) };
    return fail(error, "Couldn't send the invite");
  }
  refresh();
  return { ok: true, message: `Invite sent to ${parsed.data.email}` };
}

/** A shareable invite link (`/join/circle/<code>`). */
export async function createInviteLink(groupId: string): Promise<Result<{ path: string }>> {
  if (!id.safeParse(groupId).success) return { ok: false, error: "Invalid group" };
  try {
    const res = await authed.post<{ code: string; url_path?: string }>(`/groups/${enc(groupId)}/invite-link`);
    return { ok: true, path: res.url_path ?? `/join/circle/${res.code}` };
  } catch (error) {
    return fail(error, "Couldn't make a link");
  }
}

/** Accept / decline an invitation (the invitee) or a join request (a group admin). */
export async function respondInvite(groupId: string, inviteId: string, accept: boolean): Promise<Result> {
  if (!id.safeParse(groupId).success || !id.safeParse(inviteId).success) return { ok: false, error: "Invalid invite" };
  try {
    await authed.post(`/groups/${enc(groupId)}/invites/${enc(inviteId)}/respond`, { body: { accept } });
  } catch (error) {
    return fail(error, "Couldn't answer the invite");
  }
  refresh();
  return { ok: true, message: accept ? "Accepted" : "Declined" };
}

/** `/join/circle/<code>`: join, then open the group. */
export async function acceptInviteCode(code: string): Promise<Result> {
  if (!id.safeParse(code).success) return { ok: false, error: "That invite link isn't valid" };
  let groupId: string;
  let kind: string | undefined;
  let slug: string | null | undefined;
  try {
    const res = await authed.post<{ group_id?: string; id?: string; kind?: string; slug?: string | null }>(
      `/groups/invites/${enc(code)}/accept`,
    );
    groupId = res.group_id ?? res.id ?? "";
    kind = res.kind;
    slug = res.slug;
  } catch (error) {
    return fail(error, "Couldn't join");
  }
  refresh();
  redirect(kind === "community" ? `/communities/${slug ?? groupId}` : `/circles/${groupId}`);
}

export async function removeMember(groupId: string, userId: string): Promise<Result> {
  if (!id.safeParse(groupId).success || !id.safeParse(userId).success) return { ok: false, error: "Invalid member" };
  try {
    await authed.del(`/groups/${enc(groupId)}/members/${enc(userId)}`);
  } catch (error) {
    return fail(error, "Couldn't remove them");
  }
  refresh();
  return { ok: true, message: "Removed" };
}

export async function setMemberRole(groupId: string, userId: string, role: "admin" | "member"): Promise<Result> {
  if (!id.safeParse(groupId).success || !id.safeParse(userId).success) return { ok: false, error: "Invalid member" };
  try {
    await authed.patch(`/groups/${enc(groupId)}/members/${enc(userId)}`, { body: { role } });
  } catch (error) {
    return fail(error, "Couldn't change their role");
  }
  refresh();
  return { ok: true, message: role === "admin" ? "Made an admin" : "Now a member" };
}

// ─── shared events ──────────────────────────────────────────────────────────

const shareSchema = z.object({
  eventId: id,
  groupIds: z.array(id).min(1, "Pick at least one").max(50),
  note: z.string().trim().max(300, "Keep the note under 300 characters").optional(),
});

/** Shares one event with several circles / communities (once per group; repeats are no-ops). */
export async function shareEvent(eventId: string, groupIds: string[], note?: string): Promise<Result<{ shared: number }>> {
  const parsed = shareSchema.safeParse({ eventId, groupIds, note });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't share" };
  const { note: text } = parsed.data;
  const results = await Promise.allSettled(
    parsed.data.groupIds.map((g) =>
      authed.post(`/groups/${enc(g)}/events`, { body: { event_id: parsed.data.eventId, note: text || undefined } }),
    ),
  );
  const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  const shared = results.length - failed.length;
  if (shared > 0) refresh();
  if (failed.length && !shared) return fail(failed[0].reason, "Couldn't share it");
  return {
    ok: true,
    shared,
    message: failed.length ? `Shared with ${shared}; ${failed.length} couldn't take it` : `Shared with ${shared === 1 ? "1 group" : `${shared} groups`}`,
  };
}

export async function unshareEvent(groupId: string, eventId: string): Promise<Result> {
  if (!id.safeParse(groupId).success || !id.safeParse(eventId).success) return { ok: false, error: "Invalid event" };
  try {
    await authed.del(`/groups/${enc(groupId)}/events/${enc(eventId)}`);
  } catch (error) {
    return fail(error, "Couldn't remove it");
  }
  refresh();
  return { ok: true, message: "Removed from the group" };
}

/** "I'm interested" / "Count me in", or null to take my name off. */
export async function setInterest(groupId: string, eventId: string, status: InterestStatus | null): Promise<Result> {
  if (!id.safeParse(groupId).success || !id.safeParse(eventId).success) return { ok: false, error: "Invalid event" };
  try {
    const path = `/groups/${enc(groupId)}/events/${enc(eventId)}/interest`;
    if (status) await authed.put(path, { body: { status } });
    else await authed.del(path);
  } catch (error) {
    return fail(error, "Couldn't save that");
  }
  refresh();
  return { ok: true };
}

// ─── announcements ──────────────────────────────────────────────────────────

const announcementSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(1000, "Keep it under 1000 characters"),
});

export async function postAnnouncement(groupId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!id.safeParse(groupId).success) return { error: "Invalid community" };
  const parsed = announcementSchema.safeParse({ body: formData.get("body") ?? "" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, fieldErrors: fieldErrors(parsed.error) };
  try {
    await authed.post(`/groups/${enc(groupId)}/announcements`, { body: parsed.data });
  } catch (error) {
    return fail(error, "Couldn't post it");
  }
  refresh();
  return { ok: true, message: "Posted" };
}

// ─── inbox ──────────────────────────────────────────────────────────────────

export async function markNotificationRead(notificationId: string): Promise<Result> {
  if (!id.safeParse(notificationId).success) return { ok: false, error: "Invalid notification" };
  try {
    await authed.post(`/notifications/${enc(notificationId)}/read`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function markAllNotificationsRead(): Promise<Result> {
  try {
    await authed.post("/notifications/read-all");
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

// ─── messages ───────────────────────────────────────────────────────────────

/** Opens (or starts) a direct conversation with someone you share a group with. */
export async function startDirectMessage(userId: string): Promise<Result> {
  if (!id.safeParse(userId).success) return { ok: false, error: "Invalid person" };
  let conversationId: string;
  try {
    conversationId = (await authed.post<{ id: string }>("/messages/direct", { body: { user_id: userId } })).id;
  } catch (error) {
    if (isApiStatus(error, 403)) return { ok: false, error: apiMessage(error, COPY, { passThrough: true, fallback: COPY.no_shared_group }) };
    return fail(error, "Couldn't open the conversation");
  }
  redirect(`/messages/${conversationId}`);
}

const messageSchema = z.string().trim().min(1, "Write a message first").max(2000, "Messages are limited to 2000 characters");

export async function sendMessage(conversationId: string, body: string): Promise<Result<{ sent: ChatMessage }>> {
  if (!id.safeParse(conversationId).success) return { ok: false, error: "Invalid conversation" };
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Couldn't send" };
  try {
    const sent = await authed.post<ChatMessage>(`/messages/conversations/${enc(conversationId)}`, { body: { body: parsed.data } });
    return { ok: true, sent };
  } catch (error) {
    return fail(error, "Couldn't send. Try again.");
  }
}

export async function deleteMessage(messageId: string): Promise<Result> {
  if (!id.safeParse(messageId).success) return { ok: false, error: "Invalid message" };
  try {
    await authed.del(`/messages/${enc(messageId)}`);
    return { ok: true };
  } catch (error) {
    return fail(error, "Couldn't delete it");
  }
}

export async function markConversationRead(conversationId: string): Promise<Result> {
  if (!id.safeParse(conversationId).success) return { ok: false, error: "Invalid conversation" };
  try {
    await authed.post(`/messages/conversations/${enc(conversationId)}/read`);
    return { ok: true };
  } catch (error) {
    return fail(error);
  }
}

export async function setBlocked(userId: string, blocked: boolean): Promise<Result> {
  if (!id.safeParse(userId).success) return { ok: false, error: "Invalid person" };
  try {
    if (blocked) await authed.post("/messages/blocks", { body: { user_id: userId } });
    else await authed.del(`/messages/blocks/${enc(userId)}`);
  } catch (error) {
    return fail(error, blocked ? "Couldn't block them" : "Couldn't unblock them");
  }
  refresh();
  return { ok: true, message: blocked ? "Blocked" : "Unblocked" };
}
