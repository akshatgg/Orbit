import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listCategories } from "@/lib/events/queries";
import { loadMoreChannels } from "@/lib/social/feed-actions";
import { adminsFirst, groupCategories, plural } from "@/lib/social/format";
import { getListView, listChannels, listGroupInvites, type ChannelFilters } from "@/lib/social/queries";
import type { ChannelCard, GroupDetail, GroupInviteRow } from "@/types/social";
import { ChannelItem, ChannelRow, PinnedChannel } from "./ChannelCard";
import { CreateChannelForm } from "./CircleForms";
import { DirectoryFilters } from "./DirectoryFilters";
import { InvitePeople, JoinRequests } from "./GroupPanels";
import { ViewList, ViewProvider } from "./ListView";
import { LoadMoreCards } from "./LoadMoreCards";
import { MemberList } from "./MemberList";

const MEMBERS_SHOWN = 12;

/** One section of the home: cards or rows, as the switch says. */
function ChannelList({ label, channels, view, more }: { label: string; channels: ChannelCard[]; view: "grid" | "list"; more?: ReactNode }) {
  const Item = view === "list" ? ChannelRow : ChannelItem;
  return (
    <ViewList
      aria-label={label}
      className={view === "list"
        ? "glass mx-4 divide-y divide-line overflow-hidden rounded-[22px] md:mx-0"
        : "space-y-3 px-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 md:px-0"}
    >
      {channels.map((c) => <li key={c.id}><Item channel={c} /></li>)}
      {more}
    </ViewList>
  );
}

/**
 * A community that holds channels: Announcements pinned, "Channels you're in", "Channels you can
 * join", the directory's search, category and layout controls on top of them, and for moderators
 * a new-channel form, join requests and the invite panel. Call inside a <Suspense> boundary.
 */
export async function CommunityHome({ group, channels, filters, viewerId, allMembers }: {
  group: GroupDetail;
  /** The community's channels, unfiltered: the first page, and what the category dropdown lists. */
  channels: Awaited<ReturnType<typeof listChannels>>;
  filters: ChannelFilters;
  viewerId: string;
  allMembers: boolean;
}) {
  const slug = group.slug ?? group.id;
  const moderator = !!group.can_manage;
  const filtered = !!(filters.category || filters.q);
  const [shown, view, requests, siteCategories] = await Promise.all([
    filtered ? listChannels(slug, filters, { limit: 50 }) : channels,
    getListView("communityChannels"),
    moderator ? listGroupInvites(group.id) : Promise.resolve([] as GroupInviteRow[]),
    moderator ? listCategories() : Promise.resolve([]),
  ]);
  const pinned = shown.items.find((c) => c.is_announcements);
  const rest = shown.items.filter((c) => !c.is_announcements);
  const mine = rest.filter((c) => c.my_role);
  const open = rest.filter((c) => !c.my_role);
  const categories = [...new Map(channels.items.flatMap(groupCategories).map((c) => [c.slug ?? c.id, c.name])).entries()]
    .filter(([key]) => key)
    .sort((a, b) => a[1].localeCompare(b[1]));
  const waiting = requests.filter((r) => r.status === "pending" || !r.status);
  const members = adminsFirst(group.members ?? []);
  const more = (
    <LoadMoreCards
      key={view}
      load={loadMoreChannels.bind(null, slug, filters, view)}
      cursor={shown.nextCursor}
      view={view}
      gridSpan="md:col-span-2"
    />
  );

  return (
    <ViewProvider scope="communityChannels" view={view}>
      <div className="space-y-8 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-8 md:space-y-0 md:px-4">
        <div className="space-y-6">
          {pinned && <div className="px-4 md:px-0"><PinnedChannel channel={pinned} /></div>}

          <DirectoryFilters
            action={`/communities/${slug}`}
            searchLabel="Search channels"
            q={filters.q}
            category={filters.category}
            categories={categories}
            universities={[]}
            className="px-4 md:px-0"
          />

          {shown.items.length === 0 && (
            <div className="md:[&>div]:mx-0">
              <EmptyState title="No channels match" action={<ButtonLink href={`/communities/${slug}`} variant="secondary" size="sm">Clear filters</ButtonLink>}>
                Try another search or category.
              </EmptyState>
            </div>
          )}

          {mine.length > 0 && (
            <section aria-labelledby="channels-mine" className="space-y-3">
              <h2 id="channels-mine" className="px-4 text-lg font-semibold tracking-tight md:px-0">Channels you&apos;re in</h2>
              <ChannelList label="Channels you're in" channels={mine} view={view} more={open.length === 0 ? more : undefined} />
            </section>
          )}

          {open.length > 0 && (
            <section aria-labelledby="channels-open" className="space-y-3">
              <h2 id="channels-open" className="px-4 text-lg font-semibold tracking-tight md:px-0">Channels you can join</h2>
              <ChannelList label="Channels you can join" channels={open} view={view} more={more} />
            </section>
          )}
        </div>

        <aside className="space-y-6 px-4 md:px-0">
          {moderator && (
            <CreateChannelForm community={slug} categories={siteCategories.filter((c) => c.slug).map((c) => ({ value: c.slug!, label: c.name }))} />
          )}
          {moderator && <JoinRequests groupId={group.id} requests={waiting.filter((r) => r.kind === "request")} />}
          {moderator && <InvitePeople group={group} invites={waiting.filter((r) => r.kind === "invite")} />}

          {group.members_hidden ? (
            <section aria-label="Members" className="glass rounded-[22px] p-4">
              <p className="text-sm font-semibold tracking-tight">{plural(group.member_count, "member")}</p>
              <p className="mt-1 text-xs text-muted">Everyone is in this community, so the list stays with its moderators.</p>
            </section>
          ) : members.length > 0 && (
            <div className="space-y-2">
              <MemberList
                groupId={group.id}
                members={allMembers ? members : members.slice(0, MEMBERS_SHOWN)}
                viewerId={viewerId}
                canManage={moderator}
                kind="community"
                total={Math.max(group.member_count, members.length)}
                adminCount={members.filter((m) => m.role === "admin").length}
                canMessage={!group.auto_join}
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
          )}
        </aside>
      </div>
    </ViewProvider>
  );
}
