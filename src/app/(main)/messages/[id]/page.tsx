import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChatThread } from "@/components/messages/ChatThread";
import { BackLink } from "@/components/nav/BackLink";
import { SocialIcon } from "@/components/social/icons";
import { ThreadSkeleton } from "@/components/social/Skeletons";
import { ActionButton } from "@/components/social/SmallActions";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireProfile } from "@/lib/auth";
import { setBlocked } from "@/lib/social/actions";
import { displayName, firstName, plural } from "@/lib/social/format";
import { getThread, listBlocks } from "@/lib/social/queries";
import type { SocialUser } from "@/types/social";

export const metadata: Metadata = { title: "Messages" };

export default function ThreadPage({ params }: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<ThreadSkeleton />}>
      <Thread params={params} />
    </Suspense>
  );
}

async function Thread({ params }: { params: PageProps<"/messages/[id]">["params"] }) {
  const { id } = await params;
  // First page of messages, the viewer and their block list, all at once.
  const [profile, thread, blocks] = await Promise.all([requireProfile(), getThread(id), listBlocks()]);

  if (!thread) {
    return (
      <div className="pt-[var(--page-top,1.5rem)]">
        <div className="mb-4 px-4"><BackLink href="/messages" label="Messages" /></div>
        <EmptyState title="This conversation isn't available" action={<ButtonLink href="/messages" variant="secondary" size="sm">All messages</ButtonLink>}>
          You may have left the circle, or this conversation was closed.
        </EmptyState>
      </div>
    );
  }

  const { conversation } = thread;
  const me: SocialUser = { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url, university: profile.university };
  const other = conversation.kind === "direct" ? conversation.other_user : null;
  const blocked = !!other && blocks.some((b) => (b.user?.id ?? (b as unknown as { user_id?: string }).user_id) === other.id);
  const title = conversation.kind === "circle" ? conversation.group?.name ?? "Circle" : displayName(other);

  return (
    <div className="md:mx-auto md:max-w-2xl">
      <header className="sticky top-0 z-20 -mb-1 bg-bg/85 px-4 pb-3 pt-[var(--page-top,max(env(safe-area-inset-top),1rem))] backdrop-blur-xl md:top-16">
        <div className="flex items-center gap-3">
          <BackLink href="/messages" label="Messages" />
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {conversation.kind === "circle" ? (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                <SocialIcon name="circles" className="h-[18px] w-[18px]" />
              </span>
            ) : (
              <Avatar src={other?.avatar_url} name={title} size={36} />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold leading-tight tracking-tight">{title}</h1>
              <p className="truncate text-xs text-muted">
                {conversation.kind === "circle"
                  ? plural(conversation.members?.length ?? 0, "member")
                  : other?.university ?? "Direct message"}
              </p>
            </div>
          </div>
          {conversation.kind === "circle" && conversation.group ? (
            <Link href={`/circles/${conversation.group.id}`} className="shrink-0 text-xs font-medium text-accent hover:underline">View circle</Link>
          ) : other ? (
            <ActionButton
              action={setBlocked.bind(null, other.id, !blocked)}
              confirm={blocked ? undefined : `Block ${firstName(other)}? Neither of you will be able to message the other.`}
              label={blocked ? `Unblock ${firstName(other)}` : `Block ${firstName(other)}`}
            >
              <SocialIcon name="ban" className="h-3.5 w-3.5" /> {blocked ? "Unblock" : "Block"}
            </ActionButton>
          ) : null}
        </div>
      </header>

      <ChatThread
        key={blocked ? "blocked" : "open"}
        conversationId={conversation.id}
        initial={thread.items}
        initialHasMore={thread.has_more}
        me={me}
        kind={conversation.kind}
        canSend={!blocked}
        notice={blocked ? <>You blocked {firstName(other)}. Unblock to message them again.</> : undefined}
      />
    </div>
  );
}
