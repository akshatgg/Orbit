import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { AnnouncementCard } from "@/components/social/AnnouncementCard";
import { AnnouncementForm } from "@/components/social/CircleForms";
import { CommunityHome } from "@/components/social/CommunityHome";
import { GroupEventCard, GroupEventRow } from "@/components/social/GroupEventCard";
import { InvitePeople, JoinRequests, Membership } from "@/components/social/GroupPanels";
import { ViewList, ViewProvider, ViewToggle } from "@/components/social/ListView";
import { LoadMoreEvents } from "@/components/social/LoadMoreEvents";
import { MemberList } from "@/components/social/MemberList";
import { ShareLinkButton } from "@/components/social/ShareLinkButton";
import { CommunityHomeSkeleton } from "@/components/social/Skeletons";
import { SocialTabs } from "@/components/social/SocialTabs";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { isAdmin as isOrbitAdmin, requireProfile } from "@/lib/auth";
import { getMyEventState } from "@/lib/events/queries";
import { adminsFirst, groupCategories, groupPath, plural } from "@/lib/social/format";
import { getGroup, getListView, listAnnouncements, listChannels, listCommunities, listGroupEvents, listGroupInvites } from "@/lib/social/queries";
import type { Profile } from "@/types/database";
import type { GroupDetail, GroupInviteRow } from "@/types/social";

export const metadata: Metadata = { title: "Community" };

const MEMBERS_SHOWN = 12;

export default function CommunityPage({ params, searchParams }: PageProps<"/communities/[slug]">) {
  return (
    <Suspense fallback={<CommunityHomeSkeleton />}>
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

  const [group, channels, directory] = await Promise.all([
    getGroup(slug),
    listChannels(slug, {}, { limit: 50 }),
    listCommunities({}, { limit: 1 }),
  ]);

  // An old link to a community that has since become a channel.
  if (group?.kind === "channel") redirect(groupPath(group));

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

  // With a single community /communities comes straight here, so a link back would only return.
  const nav = directory.total > 1 ? <BackLink href="/communities" label="Communities" /> : <div className="-mx-4 -mb-1"><SocialTabs /></div>;

  // No channels (for the viewer, in old data before the move): today's page.
  if (channels.items.length === 0) {
    return <FlatCommunity group={group} nav={nav} profile={profile} allMembers={allMembers} />;
  }

  const filter = (value: string | string[] | undefined) => {
    const v = Array.isArray(value) ? value[0] : value;
    return v?.trim() ? v.trim().slice(0, 80) : undefined;
  };

  return (
    <div className="space-y-5 pb-4">
      <header className="space-y-3 px-4 pt-[var(--page-top,max(env(safe-area-inset-top),1.5rem))]">
        {nav}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight lg:text-4xl">{group.name}</h1>
            {group.description && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-muted">{group.description}</p>}
            <p className="mt-2 text-xs text-muted">{plural(group.member_count, "member")} · {plural(channels.total, "channel")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Membership group={group} leaveNote="You'll leave all its channels too." />
            {group.visibility === "public" && (
              <ShareLinkButton path={`/communities/${group.slug ?? group.id}`} title={group.name} text={group.description ?? undefined} size={group.my_role ? "sm" : "md"} />
            )}
          </div>
        </div>
      </header>
      <CommunityHome group={group} channels={channels} filters={{ q: filter(query.q), category: filter(query.category) }} viewerId={profile.id} allMembers={allMembers} />
    </div>
  );
}

/** A community with no channels: its announcements, events and members, as before channels. */
async function FlatCommunity({ group, nav, profile, allMembers }: { group: GroupDetail; nav: React.ReactNode; profile: Profile; allMembers: boolean }) {
  const slug = group.slug ?? group.id;
  // Approval communities only show their feed, members and announcements to members.
  const [feed, announcements, view] = await Promise.all([
    listGroupEvents(slug, "upcoming"),
    listAnnouncements(slug),
    getListView("communityEvents"),
  ]);

  const member = !!group.my_role;
  const moderator = group.can_manage ?? (group.my_role === "admin" || isOrbitAdmin(profile));
  const locked = !member && !moderator && group.visibility !== "public";
  const members = adminsFirst(group.members ?? []);
  const [state, requests] = await Promise.all([
    getMyEventState(profile.id, feed.items.map((i) => i.event.id)),
    moderator ? listGroupInvites(group.id) : Promise.resolve([] as GroupInviteRow[]),
  ]);
  const waiting = requests.filter((r) => r.status === "pending" || !r.status);
  const joinRequests = waiting.filter((r) => r.kind === "request");
  const shownMembers = allMembers ? members : members.slice(0, MEMBERS_SHOWN);
  const EventItem = view === "list" ? GroupEventRow : GroupEventCard;

  return (
    <div className="space-y-6 pb-4">
      <header className="space-y-3 px-4 pt-[var(--page-top,max(env(safe-area-inset-top),1.5rem))]">
        {nav}
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
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Membership group={group} />
            {group.visibility === "public" && (
              <ShareLinkButton
                path={`/communities/${group.slug ?? group.id}`}
                title={group.name}
                text={group.description ?? undefined}
                size={group.my_role || group.pending_invite ? "sm" : "md"}
              />
            )}
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
                {announcements.slice(0, 5).map((a) => (
                  // Keyed on the content too, so a server refresh with newer text replaces local state.
                  <AnnouncementCard key={`${a.id}:${a.edited_at ?? ""}`} groupId={group.id} announcement={a} />
                ))}
              </ul>
            )}
          </section>

          <ViewProvider scope="communityEvents" view={view}>
            <section aria-labelledby="community-events" className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-4 md:px-0">
                <div className="min-w-0">
                  <h2 id="community-events" className="text-lg font-semibold tracking-tight">Upcoming events</h2>
                  {(group.can_share ?? (member && group.allow_member_shares !== false)) && <p className="text-xs text-muted">Share one from any event page</p>}
                </div>
                {!locked && feed.items.length > 0 && <ViewToggle />}
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
                <ViewList
                  aria-labelledby="community-events"
                  className={view === "list"
                    ? "glass mx-4 divide-y divide-line overflow-hidden rounded-[22px] md:mx-0"
                    : "space-y-3 px-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:px-0"}
                >
                  {feed.items.map((item) => (
                    <li key={item.event.id}>
                      <EventItem
                        item={item}
                        groupId={group.id}
                        kind="community"
                        viewerId={profile.id}
                        canModerate={moderator}
                        saved={state.saved.has(item.event.id)}
                      />
                    </li>
                  ))}
                  {/* Keyed on the layout: pages loaded before a switch start over in the new one. */}
                  <LoadMoreEvents key={view} groupRef={group.id} cursor={feed.nextCursor} view={view} />
                </ViewList>
              )}
            </section>
          </ViewProvider>
        </div>

        {/* Moderators' tools make the column too tall to pin, so it scrolls with the page for them. */}
        <aside className={`space-y-6 px-4 md:px-0 ${moderator ? "" : "md:sticky md:top-24"}`}>
          {moderator && <JoinRequests groupId={group.id} requests={joinRequests} />}

          {moderator && <InvitePeople group={group} invites={waiting.filter((r) => r.kind === "invite")} />}

          {members.length > 0 ? (
            <div className="space-y-2">
              <MemberList
                groupId={group.id}
                members={shownMembers}
                viewerId={profile.id}
                canManage={moderator}
                kind="community"
                total={Math.max(group.member_count, members.length)}
                adminCount={members.filter((m) => m.role === "admin").length}
              />
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
