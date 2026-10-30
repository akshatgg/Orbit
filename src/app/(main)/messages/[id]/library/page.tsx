import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { LibraryPanel, libraryQuery, libraryTab } from "@/components/social/LibraryPanel";
import { GroupSkeleton } from "@/components/social/Skeletons";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireProfile } from "@/lib/auth";
import { displayName, groupPath } from "@/lib/social/format";
import { getThread } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Media, links and docs" };

export default function LibraryPage({ params, searchParams }: PageProps<"/messages/[id]/library">) {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <Library params={params} searchParams={searchParams} />
    </Suspense>
  );
}

/** A circle's or DM's Media, Links and Docs. A channel keeps its own on its info page. */
async function Library({ params, searchParams }: {
  params: PageProps<"/messages/[id]/library">["params"];
  searchParams: PageProps<"/messages/[id]/library">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams, requireProfile()]);
  const thread = await getThread(id, { limit: 1 });

  if (!thread) {
    return (
      <div className="pt-[var(--page-top,1.5rem)]">
        <div className="mb-4 px-4"><BackLink href="/messages" label="Messages" /></div>
        <EmptyState title="This conversation isn't available" action={<ButtonLink href="/messages" variant="secondary" size="sm">All messages</ButtonLink>}>
          You may have left the circle, or one of you blocked the other.
        </EmptyState>
      </div>
    );
  }

  const { conversation } = thread;
  if (conversation.kind === "channel" && conversation.group) redirect(`${groupPath({ ...conversation.group, kind: "channel" })}/info`);
  const title = conversation.kind === "circle" ? conversation.group?.name ?? "Circle" : displayName(conversation.other_user);

  return (
    <div className="space-y-5 pb-4 md:mx-auto md:max-w-2xl">
      <header className="space-y-3 px-4 pt-[var(--page-top,max(env(safe-area-inset-top),1.5rem))]">
        <BackLink href={`/messages/${conversation.id}`} label="Chat" />
        <div>
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight">Media, links and docs</h1>
          <p className="mt-1 truncate text-sm text-muted">{title}</p>
        </div>
      </header>
      <LibraryPanel conversationId={conversation.id} basePath={`/messages/${conversation.id}/library`} tab={libraryTab(query.tab)} q={libraryQuery(query.q)} />
    </div>
  );
}
