// Shapes the Orbit API returns for Circles, Communities, the in-app inbox and messaging.

import type { EventCardData } from "@/lib/events/queries";

/** Another person as the social endpoints show them (never their email). */
export type SocialUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
};

export type GroupKind = "circle" | "community";
export type GroupVisibility = "private" | "public" | "approval";
export type GroupRole = "admin" | "member";

export type GroupCategory = { id: string; slug: string | null; name: string };

/** One row of `GET /groups` (my circles, the communities directory). */
export type GroupCard = {
  id: string;
  kind: GroupKind;
  name: string;
  slug: string | null;
  description: string | null;
  visibility: GroupVisibility;
  category_id: string | null;
  category_name: string | null;
  university: string | null;
  cover_url: string | null;
  member_count: number;
  my_role: GroupRole | null;
  upcoming_event_count: number;
  allow_member_shares?: boolean;
  category_slug?: string | null;
  /** Every category the community covers; `category_*` above is the first one. */
  categories?: GroupCategory[];
  joined?: boolean;
  /** A few members for the avatar stack, when the API includes them. */
  members_preview?: SocialUser[];
};

/** `GET /groups/{id_or_slug}`. */
export type GroupDetail = GroupCard & {
  pending_request: boolean;
  /** An invite to this group waiting for the viewer's answer. */
  pending_invite?: { id: string } | null;
  can_manage?: boolean;
  can_invite?: boolean;
  can_share?: boolean;
  /** The first members (up to 100), when the viewer may see them. */
  members?: GroupMemberRow[];
  created_by?: string | null;
  created_at?: string;
};

export type GroupPage = { items: GroupCard[]; total: number; next_cursor: string | null; page_size?: number };

export type GroupMemberRow = { user: SocialUser; role: GroupRole; joined_at: string };

/** Admin view of `GET /groups/{id}/invites`: invitations out and join requests in. */
export type GroupInviteRow = {
  id: string;
  kind: "invite" | "request";
  status: string;
  created_at: string;
  expires_at?: string | null;
  /** The person invited, or the person asking to join. */
  user?: SocialUser | null;
  invited_user?: SocialUser | null;
  invited_by?: SocialUser | null;
  email?: string | null;
  code?: string | null;
};

/** `GET /groups/invites/mine`. */
export type MyInvite = {
  id: string;
  group: { id: string; name: string; kind: GroupKind; slug?: string | null };
  invited_by: SocialUser | null;
  created_at: string;
};

/** `GET /groups/invites/{code}`: what an invite link points at. */
export type InvitePreview = {
  id?: string;
  group_id?: string;
  kind?: GroupKind;
  name?: string;
  description?: string | null;
  group?: { id: string; name: string; kind: GroupKind; description?: string | null; member_count?: number };
  invited_by?: SocialUser | null;
  member_count?: number;
  already_member?: boolean;
  expires_at?: string | null;
};

export type InterestStatus = "interested" | "going";

/** An event as a group sees it: the card plus who shared it and who's in. */
export type GroupEventItem = {
  event: EventCardData;
  shared_by: SocialUser | null;
  note: string | null;
  shared_at: string | null;
  /** The first few of each (capped); the counts are the totals. */
  interested: SocialUser[];
  going: SocialUser[];
  interested_count?: number;
  going_count?: number;
  my_status: InterestStatus | null;
};

export type Announcement = {
  id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  /** What the viewer may do with it (the author edits; the author or a moderator deletes). */
  can_edit?: boolean;
  can_delete?: boolean;
  author?: SocialUser | null;
  event_id?: string | null;
  event_title?: string | null;
  event?: { id: string; title: string } | null;
};

/** `GET /groups/shareable?event_id=`. */
export type ShareableGroup = {
  id: string;
  kind: GroupKind;
  name: string;
  slug?: string | null;
  member_count?: number;
  already_shared: boolean;
};

// ─── in-app notifications ──────────────────────────────────────────────────

export type NotificationKind = "circle_invite" | "join_request" | "request_approved" | "event_shared" | "announcement" | (string & {});

export type InboxItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  actor: SocialUser | null;
  group_id: string | null;
  invite_id: string | null;
  read_at: string | null;
  created_at: string;
};

export type InboxPage = { items: InboxItem[]; unread_count: number; next_cursor?: string | null };

// ─── messaging ─────────────────────────────────────────────────────────────

export type ConversationKind = "circle" | "direct";

export type Conversation = {
  id: string;
  kind: ConversationKind;
  group: { id: string; name: string } | null;
  other_user: SocialUser | null;
  last_message: { body: string; sender_id: string; created_at: string; deleted?: boolean } | null;
  unread_count: number;
  last_activity_at?: string | null;
};

export type ConversationList = { items: Conversation[]; unread_total: number; next_cursor?: string | null };

export type ChatMessage = {
  id: string;
  sender: SocialUser;
  body: string;
  deleted: boolean;
  created_at: string;
  edited_at?: string | null;
};

export type Thread = {
  /** The full list item plus members on a full load; just `{id, kind, group, other_user}` on an `after` poll. */
  conversation: Conversation & { members?: SocialUser[] };
  items: ChatMessage[];
  /** Older messages remain (or, after `after`, newer ones beyond this page). */
  has_more?: boolean;
};

export type BlockedUser = { user: SocialUser; created_at?: string };
