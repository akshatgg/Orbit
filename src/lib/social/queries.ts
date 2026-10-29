import "server-only";

import { cookies } from "next/headers";
import { ApiError } from "@/lib/api/client";
import { isApiStatus } from "@/lib/api/errors";
import { apiAs, authed } from "@/lib/api/session";
import type {
  Announcement,
  BlockedUser,
  ConversationList,
  GroupDetail,
  GroupEventItem,
  GroupInviteRow,
  GroupKind,
  GroupMemberRow,
  GroupPage,
  InboxPage,
  InvitePreview,
  MyInvite,
  ShareableGroup,
  Thread,
} from "@/types/social";
import { parseView, VIEW_COOKIES, type ViewScope } from "./view";

/**
 * Reads for Circles, Communities, the inbox and messages, as the signed-in person.
 * Call inside a <Suspense> boundary; every permission is enforced by the API.
 */

const enc = encodeURIComponent;

/** A GET whose 403 / 404 / 422 means "not for you" or "gone": null instead of a throw. */
async function maybe<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T | null> {
  try {
    return await authed.get<T>(path, { query });
  } catch (error) {
    if (isApiStatus(error, 401, 403, 404, 422)) return null;
    throw error;
  }
}

export async function listMyGroups(kind: GroupKind) {
  const page = await apiAs<GroupPage>("/groups", { query: { kind, mine: 1, limit: 50 } });
  return page?.items ?? [];
}

export type DirectoryFilters = { category?: string; university?: string; q?: string };

export const DIRECTORY_PAGE = 24;

/** The communities directory, joined ones first, a page at a time (`cursor` from `next_cursor`). */
export async function listCommunities(filters: DirectoryFilters = {}, { cursor, limit = DIRECTORY_PAGE }: { cursor?: string; limit?: number } = {}) {
  const page = await apiAs<GroupPage>("/groups", { query: { kind: "community", limit, cursor, ...filters } });
  return { items: page?.items ?? [], total: page?.total ?? 0, nextCursor: page?.next_cursor ?? null };
}

/** The viewer's grid / list choice for a screen (grid until they pick). */
export async function getListView(scope: ViewScope) {
  return parseView((await cookies()).get(VIEW_COOKIES[scope])?.value);
}

export async function getGroup(idOrSlug: string) {
  return maybe<GroupDetail>(`/groups/${enc(idOrSlug)}`);
}

export async function listMembers(groupId: string) {
  const res = await maybe<{ items: GroupMemberRow[] }>(`/groups/${enc(groupId)}/members`);
  return res?.items ?? [];
}

export async function listGroupInvites(groupId: string) {
  const res = await maybe<{ items: GroupInviteRow[] }>(`/groups/${enc(groupId)}/invites`);
  return res?.items ?? [];
}

export const FEED_PAGE = 20;

/**
 * One page of a group's events (shared ones; a community adds its category's), soonest first for
 * upcoming and latest first for past. Pass the previous page's `nextCursor` for the next one.
 */
export async function listGroupEvents(
  groupId: string,
  when: "upcoming" | "past" = "upcoming",
  { cursor, limit = FEED_PAGE }: { cursor?: string; limit?: number } = {},
) {
  const res = await maybe<{ items: GroupEventItem[]; next_cursor?: string | null }>(`/groups/${enc(groupId)}/events`, {
    when,
    limit,
    cursor,
  });
  return { items: res?.items ?? [], nextCursor: res?.next_cursor ?? null };
}

export async function listAnnouncements(groupId: string) {
  const res = await maybe<{ items: Announcement[] }>(`/groups/${enc(groupId)}/announcements`);
  return res?.items ?? [];
}

export async function listMyInvites() {
  const res = await apiAs<{ items: MyInvite[] }>("/groups/invites/mine");
  return res?.items ?? [];
}

export type InviteLookup = { preview: InvitePreview } | { problem: string };

/** What an invite link points at, or why it can't be used. */
export async function previewInvite(code: string): Promise<InviteLookup> {
  try {
    return { preview: await authed.get<InvitePreview>(`/groups/invites/${enc(code)}`) };
  } catch (error) {
    if (error instanceof ApiError && [400, 403, 404, 409, 410, 422].includes(error.status)) {
      const detail = typeof (error.body as { detail?: unknown } | null)?.detail === "string"
        ? String((error.body as { detail: string }).detail)
        : "";
      return { problem: detail };
    }
    throw error;
  }
}

export async function listShareable(eventId: string) {
  const res = await authed.get<{ items: ShareableGroup[] } | ShareableGroup[]>("/groups/shareable", {
    query: { event_id: eventId },
  });
  return Array.isArray(res) ? res : res.items;
}

export async function getInbox({ limit = 20, cursor }: { limit?: number; cursor?: string } = {}) {
  return authed.get<InboxPage>("/notifications", { query: { limit, cursor } });
}

export async function listConversations(cursor?: string) {
  const res = await apiAs<ConversationList>("/messages/conversations", { query: { limit: 30, cursor } });
  return res ?? { items: [], unread_total: 0, next_cursor: null };
}

export type ThreadQuery = { after?: string; after_id?: string; before?: string; before_id?: string; changed_since?: string; limit?: number };

export async function getThread(conversationId: string, query: ThreadQuery = {}) {
  return maybe<Thread>(`/messages/conversations/${enc(conversationId)}`, { limit: 50, ...query });
}

/** The circle's chat (created on first open). Null when the viewer isn't a member. */
export async function getCircleConversationId(groupId: string) {
  const res = await maybe<{ id: string }>(`/groups/${enc(groupId)}/conversation`);
  return res?.id ?? null;
}

export async function listBlocks() {
  const res = await maybe<{ items: BlockedUser[] } | BlockedUser[]>("/messages/blocks");
  if (!res) return [];
  return Array.isArray(res) ? res : res.items;
}

/** Badge counts for the nav: unread notifications and unread messages. */
export async function getBadgeCounts() {
  const [inbox, messages] = await Promise.all([
    authed.get<InboxPage>("/notifications", { query: { unread: 1, limit: 1 } }).catch(swallow),
    authed.get<{ unread_total: number }>("/messages/unread-count").catch(swallow),
  ]);
  return { notifications: inbox?.unread_count ?? 0, messages: messages?.unread_total ?? 0 };
}

/** Signed out rethrows (so callers can answer 401); anything else counts as zero. */
function swallow(error: unknown): null {
  if (isApiStatus(error, 401)) throw error;
  return null;
}
