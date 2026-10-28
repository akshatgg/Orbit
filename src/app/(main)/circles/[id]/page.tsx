import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChatThread } from "@/components/messages/ChatThread";
import { BackLink } from "@/components/nav/BackLink";
import { InviteByEmailForm, InviteLinkButton, RenameCircleForm } from "@/components/social/CircleForms";
import { GroupEventCard } from "@/components/social/GroupEventCard";
import { SocialIcon } from "@/components/social/icons";
import { MemberList } from "@/components/social/MemberList";
import { GroupSkeleton } from "@/components/social/Skeletons";
import { ActionButton } from "@/components/social/SmallActions";
import { SegmentLinks } from "@/components/social/SocialTabs";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireProfile } from "@/lib/auth";
import { deleteGroup, leaveGroup, respondInvite } from "@/lib/social/actions";
import { displayName, plural, timeAgo } from "@/lib/social/format";
import {
  getCircleConversationId,
  getGroup,
  getThread,
  listGroupEvents,
  listGroupInvites,
  listMembers,
} from "@/lib/social/queries";
import type { GroupDetail, GroupInviteRow, SocialUser } from "@/types/social";
import type { Profile } from "@/types/database";

export const metadata: Metadata = { title: "Circle" };

type Tab = "events" | "members" | "chat";

export default function CirclePage({ params, searchParams }: PageProps<"/circles/[id]">) {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <Circle params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Circle({ params, searchParams }: {
  params: PageProps<"/circles/[id]">["params"];
  searchParams: PageProps<"/circles/[id]">["searchParams"];
}) {
  const [{ id }, query, profile] = await Promise.all([params, searchParams, requireProfile()]);
  const tab: Tab = query.tab === "members" ? "members" : query.tab === "chat" ? "chat" : "events";

  // The group and the open tab's data in parallel (the API refuses both for non-members).
  const [group, content] = await Promise.all([getGroup(id), loadTab(id, tab)]);

  if (!group || group.kind !== "circle" || !group.my_role) {
    return (
      <div className="pt-[var(--page-top,1.5rem)]">
        <div className="mb-4 px-4"><BackLink href="/circles" label="Circles" /></div>
        <EmptyState title="This circle isn't available" action={<ButtonLink href="/circles" variant="secondary" size="sm">Your circles</ButtonLink>}>
          It may have been deleted, or you&apos;re no longer a member. Ask a member for a new invite link.
        </EmptyState>
      </div>
    );
  }

  const isAdmin = group.my_role === "admin";
  const me: SocialUser = { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, university: profile.university };
  const base = `/circles/${group.id}`;

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-3 px-4 pt-[var(--page-top,max(env(safe-area-inset-top),1.5rem))]">
        <BackLink href="/circles" label="Circles" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight">{group.name}</h1>
            {group.description && <p className="mt-1 text-sm text-muted">{group.description}</p>}
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <SocialIcon name="lock" className="h-3.5 w-3.5" /> Private circle · {plural(group.member_count, "member")}
              {isAdmin && <Badge tone="brand">Admin</Badge>}
            </p>
          </div>
        </div>
      </header>

      <SegmentLinks
        label="Circle sections"
        items={[
          { href: base, label: "Events", active: tab === "events" },
          { href: `${base}?tab=members`, label: "Members", active: tab === "members" },
          { href: `${base}?tab=chat`, label: "Chat", active: tab === "chat" },
        ]}
      />

      {content.tab === "events" && <EventsTab group={group} profile={profile} upcoming={content.upcoming} past={content.past} />}
      {content.tab === "members" && <MembersTab group={group} profile={profile} members={content.members} invites={content.invites} />}
      {content.tab === "chat" && (
        content.conversationId ? (
          <section aria-label="Circle chat" className="md:mx-auto md:max-w-2xl">
            <p className="mb-2 px-4 text-right text-xs">
              <Link href={`/messages/${content.conversationId}`} className="font-medium text-accent hover:underline">Open in Messages</Link>
            </p>
            <ChatThread conversationId={content.conversationId} initial={content.messages} me={me} kind="circle" />
          </section>
        ) : (
          <EmptyState title="Chat isn't available right now">Try again in a moment.</EmptyState>
        )
      )}
    </div>
  );
}

async function loadTab(id: string, tab: Tab) {
  if (tab === "members") {
    const [members, invites] = await Promise.all([listMembers(id), listGroupInvites(id)]);
    return { tab, members, invites } as const;
  }
  if (tab === "chat") {
    const conversationId = await getCircleConversationId(id);
    const thread = conversationId ? await getThread(conversationId) : null;
    return { tab, conversationId, messages: thread?.items ?? [] } as const;
  }
  const [upcoming, past] = await Promise.all([listGroupEvents(id, "upcoming"), listGroupEvents(id, "past", { pageSize: 10 })]);
  return { tab, upcoming: upcoming.items, past: past.items } as const;
}

function EventsTab({ group, profile, upcoming, past }: {
  group: GroupDetail;
  profile: Profile;
  upcoming: Awaited<ReturnType<typeof listGroupEvents>>["items"];
  past: Awaited<ReturnType<typeof listGroupEvents>>["items"];
}) {
  const isAdmin = group.my_role === "admin";
  return (
    <div className="space-y-6">
      {upcoming.length === 0 ? (
        <EmptyState
          title="Nothing shared yet"
          action={<ButtonLink href="/search" size="sm">Find an event</ButtonLink>}
        >
          Open any event and tap <span className="font-medium text-fg">Share with a Circle</span> to post it here.
        </EmptyState>
      ) : (
        <ul className="space-y-3 px-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
          {upcoming.map((item) => (
            <li key={item.event.id}>
              <GroupEventCard item={item} groupId={group.id} kind="circle" viewerId={profile.id} canModerate={isAdmin} />
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 && (
        <details className="group mx-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full py-2 text-sm font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <SocialIcon name="chevron" className="h-4 w-4 transition-transform group-open:rotate-90" />
            Past events ({past.length})
          </summary>
          <ul className="mt-3 space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {past.map((item) => (
              <li key={item.event.id}>
                <GroupEventCard item={item} groupId={group.id} kind="circle" viewerId={profile.id} canModerate={isAdmin} past />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function MembersTab({ group, profile, members, invites }: {
  group: GroupDetail;
  profile: Profile;
  members: Awaited<ReturnType<typeof listMembers>>;
  invites: GroupInviteRow[];
}) {
  const isAdmin = group.my_role === "admin";
  const waiting = invites.filter((i) => i.status === "pending" || !i.status);
  return (
    <div className="space-y-6 px-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-8 md:space-y-0">
      <div className="space-y-6">
        <MemberList groupId={group.id} members={members} viewerId={profile.id} canManage={isAdmin} />
        {isAdmin && waiting.length > 0 && <PendingInvites groupId={group.id} invites={waiting} />}
      </div>

      <aside className="space-y-4">
        <section className="glass space-y-4 rounded-[22px] p-4" aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="text-sm font-semibold tracking-tight">Invite friends</h2>
          <InviteByEmailForm groupId={group.id} />
          <div className="border-t border-line pt-4">
            <p className="mb-2 text-xs text-muted">Or send a link anyone can use to join (expires after a while).</p>
            <InviteLinkButton groupId={group.id} groupName={group.name} />
          </div>
        </section>

        {isAdmin && (
          <section className="glass space-y-3 rounded-[22px] p-4" aria-labelledby="settings-heading">
            <h2 id="settings-heading" className="text-sm font-semibold tracking-tight">Circle settings</h2>
            <RenameCircleForm groupId={group.id} name={group.name} description={group.description} />
          </section>
        )}

        <section className="space-y-2 rounded-[22px] border border-ink/10 p-4">
          <ActionButton action={leaveGroup.bind(null, group.id, "/circles")} confirm={`Leave ${group.name}? You'll need a new invite to come back.`} variant="secondary" size="sm">
            Leave circle
          </ActionButton>
          {isAdmin && (
            <ActionButton action={deleteGroup.bind(null, group.id, "/circles")} confirm={`Delete ${group.name} for everyone? Shared events and chat go with it. This can't be undone.`} variant="danger" size="sm">
              Delete circle
            </ActionButton>
          )}
        </section>
      </aside>
    </div>
  );
}

function PendingInvites({ groupId, invites }: { groupId: string; invites: GroupInviteRow[] }) {
  return (
    <section aria-labelledby="pending-invites">
      <h2 id="pending-invites" className="mb-2 text-sm font-semibold tracking-tight">Waiting for an answer</h2>
      <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
        {invites.map((invite) => {
          const person = invite.user ?? invite.invited_user ?? null;
          const label = person ? displayName(person) : invite.email ?? (invite.code ? "Invite link" : "Invite");
          return (
            <li key={invite.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{label}</span>
                <span className="block text-xs text-muted">
                  {invite.kind === "request" ? "Asked to join" : "Invited"} · {timeAgo(invite.created_at)}
                </span>
              </span>
              {invite.kind === "request" && (
                <>
                  <ActionButton action={respondInvite.bind(null, groupId, invite.id, true)} variant="primary">Approve</ActionButton>
                  <ActionButton action={respondInvite.bind(null, groupId, invite.id, false)}>Decline</ActionButton>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
