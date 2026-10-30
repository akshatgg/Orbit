// Shapes the Orbit API returns for Circles, Communities, the in-app inbox and messaging.

import type { EventCardData } from "@/lib/events/queries";

/** Another person as the social endpoints show them (never their email). */
export type SocialUser = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  university: string | null;
};

export type GroupKind = "circle" | "community" | "channel";
export type GroupVisibility = "private" | "public" | "approval";
export type GroupRole = "admin" | "member";
/** Who may send messages in a channel: everyone in it, or its moderators (and auto-posted events). */
export type PostPolicy = "everyone" | "moderators";

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
  /** Channels: the community they sit in. */
  parent_id?: string | null;
  parent_slug?: string | null;
  parent_name?: string | null;
  post_policy?: PostPolicy;
  is_announcements?: boolean;
  /** Everyone is in it from the start, so its member list stays with those who manage it. */
  auto_join?: boolean;
  pending_request?: boolean;
};

/** One row of `GET /groups/{community}/channels`. Unread and preview are for channels I'm in. */
export type ChannelCard = GroupCard & {
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
};

/** `GET /groups/{id_or_slug}`. */
export type GroupDetail = GroupCard & {
  pending_request: boolean;
  /** An invite to this group waiting for the viewer's answer. */
  pending_invite?: { id: string } | null;
  can_manage?: boolean;
  can_invite?: boolean;
  can_share?: boolean;
  /** Channels: may send messages now. */
  can_post?: boolean;
  /** False where leaving isn't on its own (an `auto_join` channel). */
  can_leave?: boolean;
  /** The list is kept from the viewer (an `auto_join` group): `member_count` is all they get. */
  members_hidden?: boolean;
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
  /** What accepting makes them: "admin" for a moderator (circle admin) invite. */
  role?: GroupRole;
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
  group: { id: string; name: string; kind: GroupKind; slug?: string | null; parent_slug?: string | null; parent_name?: string | null };
  invited_by: SocialUser | null;
  created_at: string;
};

/** `GET /groups/invites/{code}`: what an invite link points at (404 once it has expired). */
export type InvitePreview = {
  code?: string;
  id?: string;
  group_id?: string;
  kind?: GroupKind;
  name?: string;
  description?: string | null;
  group?: {
    id: string;
    name: string;
    kind: GroupKind;
    slug?: string | null;
    description?: string | null;
    cover_url?: string | null;
    visibility?: GroupVisibility;
    member_count?: number;
    parent_id?: string | null;
    parent_slug?: string | null;
    parent_name?: string | null;
  };
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
  /** Channels: the community they sit in. */
  parent_id?: string | null;
  parent_slug?: string | null;
  parent_name?: string | null;
  post_policy?: PostPolicy;
};

// ─── in-app notifications ──────────────────────────────────────────────────

export type NotificationKind = "circle_invite" | "join_request" | "request_approved" | "event_shared" | "announcement" | "event_digest" | (string & {});

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

export type ConversationKind = "circle" | "direct" | "channel";

export type Conversation = {
  id: string;
  kind: ConversationKind;
  group: {
    id: string;
    name: string;
    kind?: GroupKind;
    slug?: string | null;
    parent_slug?: string | null;
    parent_name?: string | null;
    post_policy?: PostPolicy;
    is_announcements?: boolean;
  } | null;
  other_user: SocialUser | null;
  last_message: { body: string; sender_id: string; created_at: string; deleted?: boolean; kind?: MessageKind; preview?: string | null } | null;
  unread_count: number;
  last_activity_at?: string | null;
  can_post?: boolean;
  /** May delete anyone's message (a channel's moderators). */
  can_moderate?: boolean;
};

export type ConversationList = { items: Conversation[]; unread_total: number; next_cursor?: string | null };

export type MessageKind = "text" | "media" | "event" | "system" | "summary";

/** What a daily summary counts: one row per category, with where to see them. */
export type SummaryData = {
  total: number;
  categories: { name: string; count: number; cover_url: string | null; href: string }[];
};

export type MessageAttachment = {
  id: string;
  kind: "image" | "doc";
  url: string;
  public_id: string;
  name: string | null;
  mime: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
};

/** What a message sends with it: an upload that has just finished, before it has an id. */
export type AttachmentInput = Omit<MessageAttachment, "id">;

/** A link in a message. The preview fields fill in shortly after sending, when a page has them. */
export type MessageLink = {
  id: string;
  url: string;
  domain: string | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
};

export type ChatMessage = {
  id: string;
  /** Null on what ORBIT posts itself (the daily events and "and N more"). */
  sender: SocialUser | null;
  body: string;
  deleted: boolean;
  created_at: string;
  edited_at?: string | null;
  kind?: MessageKind;
  /** Summary messages: the rows of the card. */
  data?: SummaryData | null;
  /** Event messages: the card, or null when the event is gone or hidden. */
  event?: EventCardData | null;
  attachments?: MessageAttachment[];
  links?: MessageLink[];
};

export type Thread = {
  /** The full list item plus members on a full load; just `{id, kind, group, other_user}` on an `after` poll. */
  conversation: Conversation & { members?: SocialUser[] };
  items: ChatMessage[];
  /** Older messages remain (or, after `after`, newer ones beyond this page). */
  has_more?: boolean;
  /** With `changed_since`: messages edited or deleted since then (replace them by id). */
  changed?: ChatMessage[];
  /** Server time of this response: the next poll's `changed_since`. */
  polled_at?: string;
  /** Added by this app: which of the page's event messages the viewer has saved. */
  saved_event_ids?: string[];
};

export type LibraryTab = "media" | "links" | "docs";

/** One row of a conversation's Media, Links or Docs: attachment fields, or link fields. */
export type LibraryItem = {
  id: string;
  message_id: string;
  sender: SocialUser | null;
  created_at: string;
} & Partial<Omit<MessageAttachment, "id">> & Partial<Omit<MessageLink, "id" | "url">> & {
  url?: string | null;
  type?: "link" | "event";
  event?: EventCardData | null;
};

export type LibraryPage = { items: LibraryItem[]; next_cursor: string | null; page_size?: number };

export type BlockedUser = { user: SocialUser; created_at?: string };
