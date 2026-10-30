import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { ChannelSettingsForm } from "@/components/social/CircleForms";
import { GroupEventCard, GroupEventRow } from "@/components/social/GroupEventCard";
import { InvitePeople, JoinRequests, Membership } from "@/components/social/GroupPanels";
import { LibraryPanel, libraryQuery, libraryTab } from "@/components/social/LibraryPanel";
import { ViewList, ViewProvider, ViewToggle } from "@/components/social/ListView";
import { LoadMoreEvents } from "@/components/social/LoadMoreEvents";
import { MemberList } from "@/components/social/MemberList";
import { ShareLinkButton } from "@/components/social/ShareLinkButton";
import { GroupSkeleton } from "@/components/social/Skeletons";
import { ActionButton } from "@/components/social/SmallActions";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireProfile } from "@/lib/auth";
import { getMyEventState, listCategories } from "@/lib/events/queries";
import { deleteGroup } from "@/lib/social/actions";
import { adminsFirst, groupCategories, groupPath, plural } from "@/lib/social/format";
import { getGroup, getGroupConversationId, getListView, listGroupEvents, listGroupInvites } from "@/lib/social/queries";
import type { GroupInviteRow } from "@/types/social";

export const metadata: Metadata = { title: "Channel info" };

const MEMBERS_SHOWN = 8;
const EVENTS_SHOWN = 6;

export default function ChannelInfoPage({ params, searchParams }: PageProps<"/communities/[slug]/[channel]/info">) {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <Info params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Info({ params, searchParams }: {
  params: PageProps<"/communities/[slug]/[channel]/info">["params"];
  searchParams: PageProps<"/communities/[slug]/[channel]/info">["searchParams"];
}) {
  const [{ slug, channel: ref }, query, profile] = await Promise.all([params, searchParams, requireProfile()]);
  const [group, feed, view] = await Promise.all([
    getGroup(ref),
    listGroupEvents(ref, "upcoming", { limit: EVENTS_SHOWN }),
    getListView("communityEvents"),
  ]);

  if (!group || group.kind !== "channel") {
    return (
      <div className="pt-[var(--page-top,1.5rem)]">
        <div className="mb-4 px-4"><BackLink href={`/communities/${slug}`} label="Back" /></div>
        <EmptyState title="This channel isn't available" action={<ButtonLink href={`/communities/${slug}`} variant="secondary" size="sm">All channels</ButtonLink>}>
          It may be private or no longer running.
        </EmptyState>
      </div>
    );
  }
  const base = groupPath(group);
  if (group.parent_slug && group.parent_slug !== slug) redirect(`${base}/info`);

  const member = !!group.my_role;
  const moderator = !!group.can_manage;
  const locked = !member && !moderator && group.visibility !== "public";
  const announcements = !!group.is_announcements;
  const members = adminsFirst(group.members ?? []);
  const allMembers = query.members === "all";
  const [state, requests, categories, conversationId] = await Promise.all([
    getMyEventState(profile.id, feed.items.map((i) => i.event.id)),
    moderator ? listGroupInvites(group.id) : Promise.resolve([] as GroupInviteRow[]),
    moderator ? listCategories() : Promise.resolve([]),
    // The chat's library is for members only: nobody else asks for its conversation.
    member ? getGroupConversationId(group.id) : Promise.resolve(null),
  ]);
  const waiting = requests.filter((r) => r.status === "pending" || !r.status);
  const EventItem = view === "list" ? GroupEventRow : GroupEventCard;

  return (
    <div className="space-y-6 pb-4">
      <header className="space-y-3 px-4 pt-[var(--page-top,max(env(safe-area-inset-top),1.5rem))]">
        <BackLink href={base} label={member ? "Chat" : group.name.length > 24 ? "Channel" : group.name} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {groupCategories(group).map((c) => <Badge key={c.id || c.name} tone="brand">{c.name}</Badge>)}
              {group.visibility === "approval" && <Badge tone="warning">Approval to join</Badge>}
              {group.visibility === "private" && <Badge>Private</Badge>}
              {group.post_policy === "moderators" && <Badge>Moderators post</Badge>}
            </div>
            <h1 className="mt-2.5 text-[1.75rem] font-semibold leading-tight tracking-tight lg:text-4xl">{group.name}</h1>
            <p className="mt-1 text-sm text-muted">
              In <Link href={`/communities/${slug}`} className="font-medium text-accent hover:underline">{group.parent_name ?? slug}</Link>
            </p>
            {group.description && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{group.description}</p>}
            <p className="mt-2 text-xs text-muted">{plural(group.member_count, "member")} · {plural(group.upcoming_event_count ?? 0, "upcoming event")}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Membership group={group} leaveTo={`/communities/${slug}`} />
            {group.visibility === "public" && <ShareLinkButton path={base} title={group.name} text={group.description ?? undefined} size={member ? "sm" : "md"} />}
          </div>
        </div>
      </header>

      <div className="space-y-8 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-8 md:space-y-0 md:px-4">
        {/* Phones: who's here first; from `md` it's the side column. */}
        <aside className="space-y-6 px-4 md:order-last md:px-0">
          {moderator && <JoinRequests groupId={group.id} requests={waiting.filter((r) => r.kind === "request")} />}
          {moderator && <InvitePeople group={group} invites={waiting.filter((r) => r.kind === "invite")} />}

          {group.members_hidden ? (
            <section aria-label="Members" className="glass rounded-[22px] p-4">
              <p className="text-sm font-semibold tracking-tight">{plural(group.member_count, "member")}</p>
              <p className="mt-1 text-xs text-muted">Everyone in the community is in this channel. Only moderators see the list.</p>
            </section>
          ) : members.length > 0 ? (
            <div className="space-y-2">
              <MemberList
                groupId={group.id}
                members={allMembers ? members : members.slice(0, MEMBERS_SHOWN)}
                viewerId={profile.id}
                canManage={moderator}
                kind="community"
                total={Math.max(group.member_count, members.length)}
                adminCount={members.filter((m) => m.role === "admin").length}
                canMessage={!group.auto_join}
              />
              {members.length > MEMBERS_SHOWN && (
                <Link href={allMembers ? base + "/info" : `${base}/info?members=all`} scroll={false} className="block text-center text-xs font-medium text-accent hover:underline">
                  {allMembers ? "Show fewer" : `Show all ${members.length} members`}
                </Link>
              )}
            </div>
          ) : (
            !member && <p className="text-sm text-muted">Join to see who&apos;s here.</p>
          )}

          {moderator && (
            <section className="glass space-y-3 rounded-[22px] p-4" aria-labelledby="channel-settings">
              <h2 id="channel-settings" className="text-sm font-semibold tracking-tight">Channel settings</h2>
              <ChannelSettingsForm group={group} categories={categories.filter((c) => c.slug).map((c) => ({ value: c.slug!, label: c.name }))} />
              {!announcements && (
                <div className="border-t border-line pt-3">
                  <ActionButton action={deleteGroup.bind(null, group.id, `/communities/${slug}`)} confirm={`Delete ${group.name} for everyone? Its chat goes with it. This can't be undone.`} variant="danger">
                    Delete channel
                  </ActionButton>
                </div>
              )}
            </section>
          )}
        </aside>

        <div className="space-y-8">
          <ViewProvider scope="communityEvents" view={view}>
            <section aria-labelledby="channel-events" className="space-y-3">
              <div className="flex items-center justify-between gap-3 px-4 md:px-0">
                <div className="min-w-0">
                  <h2 id="channel-events" className="text-lg font-semibold tracking-tight">Upcoming events</h2>
                  {group.can_share && <p className="text-xs text-muted">Share one from any event page</p>}
                </div>
                {!locked && feed.items.length > 0 && <ViewToggle />}
              </div>
              {locked ? (
                <div className="md:[&>div]:mx-0">
                  <EmptyState title="Members only">{group.pending_request ? "Your request is with the moderators." : "Ask to join to see this channel's events."}</EmptyState>
                </div>
              ) : feed.items.length === 0 ? (
                <div className="md:[&>div]:mx-0">
                  <EmptyState title="No upcoming events yet">Events shared here, and new ones in this channel&apos;s categories, show up here.</EmptyState>
                </div>
              ) : (
                <ViewList
                  aria-labelledby="channel-events"
                  className={view === "list"
                    ? "glass mx-4 divide-y divide-line overflow-hidden rounded-[22px] md:mx-0"
                    : "space-y-3 px-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 md:px-0"}
                >
                  {feed.items.map((item) => (
                    <li key={item.event.id}>
                      <EventItem item={item} groupId={group.id} kind="channel" viewerId={profile.id} canModerate={moderator} saved={state.saved.has(item.event.id)} />
                    </li>
                  ))}
                  <LoadMoreEvents key={view} groupRef={group.id} cursor={feed.nextCursor} view={view} />
                </ViewList>
              )}
            </section>
          </ViewProvider>

          {conversationId ? (
            <LibraryPanel conversationId={conversationId} basePath={`${base}/info`} tab={libraryTab(query.tab)} q={libraryQuery(query.q)} />
          ) : (
            <section aria-label="Media, links and docs" className="px-4 md:px-0">
              <p className="text-sm text-muted">Join to see the photos, links and documents shared here.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
