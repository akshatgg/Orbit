import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { AnnouncementForm } from "@/components/social/CircleForms";
import { GroupEventCard } from "@/components/social/GroupEventCard";
import { SocialIcon } from "@/components/social/icons";
import { LoadMoreEvents } from "@/components/social/LoadMoreEvents";
import { MemberList } from "@/components/social/MemberList";
import { GroupSkeleton } from "@/components/social/Skeletons";
import { ActionButton } from "@/components/social/SmallActions";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isAdmin as isOrbitAdmin, requireProfile } from "@/lib/auth";
import { getMyEventState } from "@/lib/events/queries";
import { joinGroup, leaveGroup, respondInvite } from "@/lib/social/actions";
import { displayName, groupCategories, plural, timeAgo } from "@/lib/social/format";
import { getGroup, listAnnouncements, listGroupEvents, listGroupInvites } from "@/lib/social/queries";
import type { Announcement, GroupDetail, GroupInviteRow } from "@/types/social";

export const metadata: Metadata = { title: "Community" };

const MEMBERS_SHOWN = 12;

export default function CommunityPage({ params, searchParams }: PageProps<"/communities/[slug]">) {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <Community params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Community({ params, searchParams }: {
  params: PageProps<"/communities/[slug]">["params"];
  searchParams: PageProps<"/communities/[slug]">["searchParams"];
}) {
  const [{ slug }, query, profile] = await Promise.all([params, searchParams, requireProfile()]);
  const allMembers = query.members === "all";

  // Everything the page shows, in parallel (the API answers each by slug or id; members come with
  // the group). Approval communities only show their feed, members and announcements to members.
  const [group, feed, announcements] = await Promise.all([
    getGroup(slug),
    listGroupEvents(slug, "upcoming"),
    listAnnouncements(slug),
  ]);

  if (!group || group.kind !== "community") {
    return (
      <div className="pt-[var(--page-top,1.5rem)]">
        <div className="mb-4 px-4"><BackLink href="/communities" label="Communities" /></div>
        <EmptyState title="This community isn't available" action={<ButtonLink href="/communities" variant="secondary" size="sm">All communities</ButtonLink>}>
          It may be private or no longer running.
        </EmptyState>
      </div>
    );
  }

  const member = !!group.my_role;
  const moderator = group.can_manage ?? (group.my_role === "admin" || isOrbitAdmin(profile));
  const locked = !member && !moderator && group.visibility !== "public";
  const members = group.members ?? [];
  const [state, requests] = await Promise.all([
    getMyEventState(profile.id, feed.items.map((i) => i.event.id)),
    moderator ? listGroupInvites(group.id) : Promise.resolve([] as GroupInviteRow[]),
  ]);
  const joinRequests = requests.filter((r) => r.kind === "request" && (r.status === "pending" || !r.status));
  const shownMembers = allMembers ? members : members.slice(0, MEMBERS_SHOWN);

  return (
    <div className="space-y-6 pb-4">
      <header className="space-y-3 px-4 pt-[var(--page-top,max(env(safe-area-inset-top),1.5rem))]">
        <BackLink href="/communities" label="Communities" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {groupCategories(group).map((c) => (
                <Link key={c.id || c.name} href={c.slug ? `/communities?category=${encodeURIComponent(c.slug)}` : "/communities"} className="rounded-full">
                  <Badge tone="brand">{c.name}</Badge>
                </Link>
              ))}
              {group.university && <Badge>{group.university}</Badge>}
              {group.visibility === "approval" && <Badge tone="warning">Approval to join</Badge>}
              {group.visibility === "private" && <Badge>Private</Badge>}
            </div>
            <h1 className="mt-2.5 text-[1.75rem] font-semibold leading-tight tracking-tight lg:text-4xl">{group.name}</h1>
            {group.description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{group.description}</p>}
            <p className="mt-2 text-xs text-muted">{plural(group.member_count, "member")} · {plural(group.upcoming_event_count ?? 0, "upcoming event")}</p>
          </div>
          <div className="shrink-0">
            <Membership group={group} />
          </div>
        </div>
      </header>

      <div className="space-y-8 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-8 md:space-y-0 md:px-4">
        <div className="space-y-8">
          <section aria-labelledby="announcements" className="space-y-3 px-4 md:px-0">
            <h2 id="announcements" className="text-lg font-semibold tracking-tight">Announcements</h2>
            {moderator && <AnnouncementForm groupId={group.id} />}
            {locked && <p className="text-sm text-muted">Announcements are for members.</p>}
            {locked ? null : announcements.length === 0 ? (
              <p className="text-sm text-muted">{member || moderator ? "No announcements yet." : "Join to read announcements from the organisers."}</p>
            ) : (
              <ul className="space-y-2.5">
                {announcements.slice(0, 5).map((a) => <AnnouncementItem key={a.id} announcement={a} />)}
              </ul>
            )}
          </section>

          <section aria-labelledby="community-events" className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-4 md:px-0">
              <h2 id="community-events" className="text-lg font-semibold tracking-tight">Upcoming events</h2>
              {(group.can_share ?? (member && group.allow_member_shares !== false)) && <p className="text-xs text-muted">Share one from any event page</p>}
            </div>
            {locked ? (
              <div className="md:[&>div]:mx-0">
                <EmptyState title="Members only">
                  {group.pending_request ? "Your request is with the moderators." : "Ask to join to see this community's events, members and announcements."}
                </EmptyState>
              </div>
            ) : feed.items.length === 0 ? (
              <div className="md:[&>div]:mx-0">
                <EmptyState title="No upcoming events yet">Events shared here, and new ones in this community&apos;s categories, show up here.</EmptyState>
              </div>
            ) : (
              <ul className="space-y-3 px-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:px-0">
                {feed.items.map((item) => (
                  <li key={item.event.id}>
                    <GroupEventCard
                      item={item}
                      groupId={group.id}
                      kind="community"
                      viewerId={profile.id}
                      canModerate={moderator}
                      saved={state.saved.has(item.event.id)}
                    />
                  </li>
                ))}
                <LoadMoreEvents groupRef={group.id} cursor={feed.nextCursor} />
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6 px-4 md:sticky md:top-24 md:px-0">
          {moderator && joinRequests.length > 0 && (
            <section aria-labelledby="join-requests" className="space-y-2">
              <h2 id="join-requests" className="text-sm font-semibold tracking-tight">Join requests</h2>
              <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
                {joinRequests.map((r) => {
                  const person = r.user ?? r.invited_user ?? r.invited_by ?? null;
                  return (
                    <li key={r.id} className="flex items-center gap-2.5 px-4 py-3">
                      <Avatar src={person?.avatar_url} name={displayName(person)} size={32} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(person)}</span>
                      <ActionButton action={respondInvite.bind(null, group.id, r.id, true)} variant="primary">Approve</ActionButton>
                      <ActionButton action={respondInvite.bind(null, group.id, r.id, false)} label="Decline request">
                        <SocialIcon name="x" className="h-3.5 w-3.5" />
                      </ActionButton>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {members.length > 0 ? (
            <div className="space-y-2">
              <MemberList groupId={group.id} members={shownMembers} viewerId={profile.id} canManage={moderator} kind="community" />
              {members.length > MEMBERS_SHOWN && (
                <Link
                  href={allMembers ? `/communities/${slug}` : `/communities/${slug}?members=all`}
                  scroll={false}
                  className="block text-center text-xs font-medium text-accent hover:underline"
                >
                  {allMembers ? "Show fewer" : `Show all ${members.length} members`}
                </Link>
              )}
            </div>
          ) : (
            !member && <p className="text-sm text-muted">Join to see who&apos;s here.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function Membership({ group }: { group: GroupDetail }) {
  if (!group.my_role && group.pending_invite) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">You&apos;re invited</span>
        <ActionButton action={respondInvite.bind(null, group.id, group.pending_invite.id, true)} variant="primary">Accept</ActionButton>
        <ActionButton action={respondInvite.bind(null, group.id, group.pending_invite.id, false)} variant="secondary">Decline</ActionButton>
      </div>
    );
  }
  if (group.my_role) {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="success" className="h-8 px-3 text-xs">Joined</Badge>
        <ActionButton action={leaveGroup.bind(null, group.id, undefined)} confirm={`Leave ${group.name}?`} variant="secondary">
          Leave
        </ActionButton>
      </div>
    );
  }
  if (group.pending_request) return <Badge tone="warning" className="h-8 px-3 text-xs">Request sent</Badge>;
  if (group.visibility === "private") return <Badge className="h-8 px-3 text-xs">Invite only</Badge>;
  return (
    <ActionButton action={joinGroup.bind(null, group.id)} variant="primary" size="md">
      {group.visibility === "approval" ? "Request to join" : "Join community"}
    </ActionButton>
  );
}

function AnnouncementItem({ announcement: a }: { announcement: Announcement }) {
  const event = a.event ?? (a.event_id ? { id: a.event_id, title: a.event_title ?? "See the event" } : null);
  return (
    <li className="glass rounded-[20px] p-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        <SocialIcon name="megaphone" className="h-3.5 w-3.5 text-accent" />
        <span className="font-medium text-fg">{displayName(a.author, "Organisers")}</span>
        <span>· {timeAgo(a.created_at)}</span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{a.body}</p>
      {event && (
        <Link href={`/events/${event.id}`} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
          {event.title} <SocialIcon name="chevron" className="h-3 w-3" />
        </Link>
      )}
    </li>
  );
}
