import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ChatThread } from "@/components/messages/ChatThread";
import { BackLink } from "@/components/nav/BackLink";
import { ChannelSidebar } from "@/components/social/ChannelCard";
import { Membership } from "@/components/social/GroupPanels";
import { SocialIcon } from "@/components/social/icons";
import { ChannelSkeleton } from "@/components/social/Skeletons";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireProfile } from "@/lib/auth";
import { groupPath, plural, timeAgo } from "@/lib/social/format";
import { getGroup, getGroupConversationId, getThread, listChannels } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Channel" };

export default function ChannelPage({ params }: PageProps<"/communities/[slug]/[channel]">) {
  return (
    <Suspense fallback={<ChannelSkeleton />}>
      <Channel params={params} />
    </Suspense>
  );
}

/** A short community name as the back link's label; a long one wouldn't leave room for the channel's. */
function backLabel(name: string | null | undefined) {
  return name && name.length <= 12 ? name : "Channels";
}

async function Channel({ params }: { params: PageProps<"/communities/[slug]/[channel]">["params"] }) {
  const [{ slug, channel: ref }, profile] = await Promise.all([params, requireProfile()]);
  const [group, list] = await Promise.all([getGroup(ref), listChannels(slug, {}, { limit: 50 })]);

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
  // One address per channel: a link with another community's name in it moves to the real one.
  if (group.parent_slug && group.parent_slug !== slug) redirect(groupPath(group));

  // The chat is for members; everyone else gets the card and a way in, with no call for the chat.
  const member = !!group.my_role;
  const conversationId = member ? await getGroupConversationId(group.id) : null;
  const thread = conversationId ? await getThread(conversationId) : null;
  const base = groupPath(group);
  const card = list.items.find((c) => c.id === group.id);

  return (
    <div className="md:grid md:grid-cols-[17rem_minmax(0,1fr)] md:items-start md:gap-6">
      <aside className="hidden pt-[var(--page-top,1.5rem)] md:sticky md:top-16 md:block md:max-h-[calc(100dvh-5rem)] md:overflow-y-auto">
        <ChannelSidebar community={slug} name={group.parent_name ?? slug} channels={list.items} active={group.id} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 -mb-1 bg-bg/85 px-4 pb-3 pt-[var(--page-top,max(env(safe-area-inset-top),1rem))] backdrop-blur-xl md:top-16">
          <div className="flex items-center gap-3">
            <BackLink href={`/communities/${slug}`} label={backLabel(group.parent_name)} />
            <Link href={`${base}/info`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <SocialIcon name={group.is_announcements ? "megaphone" : group.visibility === "private" ? "lock" : "chat"} className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-base font-semibold leading-tight tracking-tight">{group.name}</span>
                <span className="block truncate text-xs text-muted">
                  {plural(group.member_count, "member")}{group.post_policy === "moderators" && " · Moderators post"}
                </span>
              </span>
            </Link>
            <Link href={`${base}/info`} aria-label="Channel info" title="Channel info" className="glass flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:text-fg">
              <SocialIcon name="info" className="h-[18px] w-[18px]" />
            </Link>
          </div>
        </header>

        {member && conversationId ? (
          <ChatThread
            conversationId={conversationId}
            initial={thread?.items ?? []}
            initialHasMore={thread?.has_more}
            initialPolledAt={thread?.polled_at}
            initialSaved={thread?.saved_event_ids}
            me={{ id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, university: profile.university }}
            kind="channel"
            canSend={thread?.conversation.can_post ?? group.can_post ?? false}
            canModerate={thread?.conversation.can_moderate ?? false}
            notice="Only moderators can send messages"
          />
        ) : member ? (
          <div className="mt-4"><EmptyState title="Chat isn't available right now">Try again in a moment.</EmptyState></div>
        ) : (
          <section aria-label="Join this channel" className="glass mx-4 mt-4 space-y-3 rounded-[22px] p-5 text-center">
            {group.description && <p className="text-[15px] leading-relaxed text-muted">{group.description}</p>}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {group.visibility === "approval" && <Badge tone="warning">Approval to join</Badge>}
              {group.visibility === "private" && <Badge>Private</Badge>}
              {card?.last_message_at && <Badge>Active {timeAgo(card.last_message_at)}</Badge>}
            </div>
            <p className="text-sm text-muted">{group.pending_request ? "Your request is with the moderators." : "Join to read the chat and see what's been shared."}</p>
            <div className="flex justify-center">
              <Membership group={group} leaveTo={`/communities/${slug}`} />
            </div>
            <p><Link href={`${base}/info`} className="text-xs font-medium text-accent hover:underline">See this channel&apos;s events</Link></p>
          </section>
        )}
      </div>
    </div>
  );
}
