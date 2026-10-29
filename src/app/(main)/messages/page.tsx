import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SocialIcon } from "@/components/social/icons";
import { ConversationsSkeleton } from "@/components/social/Skeletons";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";
import { displayName, timeAgo } from "@/lib/social/format";
import { setBlocked } from "@/lib/social/actions";
import { listBlocks, listConversations } from "@/lib/social/queries";
import { ActionButton } from "@/components/social/SmallActions";
import type { BlockedUser, Conversation } from "@/types/social";

export const metadata: Metadata = { title: "Messages" };

const SUBTITLE = "Circle chats and direct messages with people you share a circle or community with.";

export default function MessagesPage({ searchParams }: PageProps<"/messages">) {
  return (
    <>
      <PageHeader title="Messages" subtitle={SUBTITLE} />
      <Suspense fallback={<ConversationsSkeleton />}>
        <Conversations searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Conversations({ searchParams }: { searchParams: PageProps<"/messages">["searchParams"] }) {
  const { cursor: raw } = await searchParams;
  const cursor = typeof raw === "string" && /^[\w-]{1,500}$/.test(raw) ? raw : undefined;
  const [profile, { items, next_cursor: next }, blocks] = await Promise.all([requireProfile(), listConversations(cursor), listBlocks()]);
  if (items.length === 0 && !cursor) {
    return (
      <div className="space-y-8">
        <EmptyState title="No conversations yet" action={<ButtonLink href="/circles" size="sm" variant="secondary">Your circles</ButtonLink>}>
          Every circle has a chat, and you can message anyone you share a circle or community with from its member list.
        </EmptyState>
        <Blocked blocks={blocks} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <ul className="glass mx-4 divide-y divide-line overflow-hidden rounded-[22px] md:max-w-2xl">
        {items.map((c) => <li key={c.id}><ConversationRow conversation={c} meId={profile.id} /></li>)}
      </ul>
      {(next || cursor) && (
        <nav aria-label="More conversations" className="mx-4 flex justify-between gap-3 md:max-w-2xl">
          {cursor ? <ButtonLink href="/messages" variant="secondary" size="sm">Newest</ButtonLink> : <span />}
          {next && <ButtonLink href={`/messages?cursor=${encodeURIComponent(next)}`} variant="secondary" size="sm">Older conversations</ButtonLink>}
        </nav>
      )}
      <Blocked blocks={blocks} />
    </div>
  );
}

/** People you've blocked: their conversations are hidden until you unblock them. */
function Blocked({ blocks }: { blocks: BlockedUser[] }) {
  if (!blocks.length) return null;
  return (
    <section aria-labelledby="blocked" className="mx-4 space-y-2 pt-4 md:max-w-2xl">
      <h2 id="blocked" className="text-sm font-semibold tracking-tight">Blocked</h2>
      <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
        {blocks.map(({ user }) => (
          <li key={user.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar src={user.avatar_url} name={displayName(user)} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(user)}</span>
            <ActionButton action={setBlocked.bind(null, user.id, false)} variant="secondary">Unblock</ActionButton>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ConversationRow({ conversation: c, meId }: { conversation: Conversation; meId: string }) {
  const title = c.kind === "circle" ? c.group?.name ?? "Circle" : displayName(c.other_user);
  const last = c.last_message;
  const preview = !last ? "No messages yet" : last.deleted ? "Message deleted" : `${last.sender_id === meId ? "You: " : ""}${last.body}`;
  const unread = c.unread_count > 0;
  return (
    <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-ink/[0.05]">
      {c.kind === "circle" ? (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
          <SocialIcon name="circles" className="h-5 w-5" />
        </span>
      ) : (
        <Avatar src={c.other_user?.avatar_url} name={title} size={44} />
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-sm ${unread ? "font-semibold" : "font-medium"}`}>{title}</span>
          {last && <span className="shrink-0 text-[11px] text-subtle">{timeAgo(last.created_at)}</span>}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`truncate text-xs ${unread ? "text-fg" : "text-muted"} ${last?.deleted ? "italic" : ""}`}>{preview}</span>
          {unread && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[10.5px] font-semibold text-white tabular-nums">
              {c.unread_count > 99 ? "99+" : c.unread_count}
              <span className="sr-only"> unread</span>
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
