import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/ActionButton";
import { ActionButton as RedirectingAction } from "@/components/social/SmallActions";
import { CommunityForm } from "@/components/admin/CommunityForm";
import { IconTrash } from "@/components/admin/icons";
import { AdminHeader, Panel, TableSkeleton } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/events/queries";
import { displayName, timeAgo } from "@/lib/social/format";
import { getGroup, listGroupInvites, listMembers } from "@/lib/social/queries";
import { answerJoinRequest, deleteCommunity, removeCommunityMember, setModerator } from "../actions";

export const metadata: Metadata = { title: "Community · Admin" };

export default function Page({ params, searchParams }: PageProps<"/admin/communities/[id]">) {
  return (
    <>
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
      <Toaster />
    </>
  );
}

async function Content({ params, searchParams }: {
  params: PageProps<"/admin/communities/[id]">["params"];
  searchParams: PageProps<"/admin/communities/[id]">["searchParams"];
}) {
  const [{ id }, query] = await Promise.all([params, searchParams, requireAdmin()]);
  const [group, categories, members, invites] = await Promise.all([getGroup(id), listCategories(), listMembers(id), listGroupInvites(id)]);
  if (!group || group.kind !== "community") notFound();
  const requests = invites.filter((r) => r.kind === "request" && (r.status === "pending" || !r.status));

  return (
    <>
      <AdminHeader
        eyebrow="Communities"
        title={group.name}
        subtitle={query.created ? "Created. Add moderators from the member list once people join." : undefined}
        action={
          <>
            <Link href={`/communities/${group.slug ?? group.id}`} className="glass inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold">View page</Link>
            <RedirectingAction
              action={deleteCommunity.bind(null, group.id)}
              variant="danger"
              label={`Delete ${group.name}`}
              confirm={`Delete ${group.name}? Members, announcements and shared events go with it. This can't be undone.`}
            >
              <IconTrash size={14} /> Delete
            </RedirectingAction>
          </>
        }
      />
      <div className="space-y-6">
        <Panel title="Details">
          <CommunityForm
            community={{
              id: group.id,
              name: group.name,
              slug: group.slug,
              description: group.description,
              category_id: group.category_id,
              university: group.university,
              visibility: group.visibility,
              allow_member_shares: group.allow_member_shares,
              cover_url: group.cover_url,
            }}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          />
        </Panel>

        <Panel title={`Join requests (${requests.length})`}>
          {requests.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No one is waiting.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {requests.map((r) => {
                const person = r.user ?? r.invited_user ?? r.invited_by ?? null;
                return (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar src={person?.avatar_url} name={displayName(person)} size={32} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block truncate font-medium">{displayName(person)}</span>
                      <span className="block text-xs text-subtle">{person?.university ?? "Asked"} · {timeAgo(r.created_at)}</span>
                    </span>
                    <ActionButton action={answerJoinRequest.bind(null, group.id, r.id, true)} variant="primary">Approve</ActionButton>
                    <ActionButton action={answerJoinRequest.bind(null, group.id, r.id, false)}>Decline</ActionButton>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title={`Members (${members.length})`}>
          {members.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No members yet.</p>
          ) : (
            <ul className="divide-y divide-line/60">
              {members.map(({ user, role }) => (
                <li key={user.id} className="flex items-center gap-3 px-5 py-3">
                  <Avatar src={user.avatar_url} name={displayName(user)} size={32} />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="flex items-center gap-1.5 truncate font-medium">
                      {displayName(user)}
                      {role === "admin" && <Badge tone="brand">Moderator</Badge>}
                    </span>
                    {user.university && <span className="block text-xs text-subtle">{user.university}</span>}
                  </span>
                  <ActionButton action={setModerator.bind(null, group.id, user.id, role !== "admin")}>
                    {role === "admin" ? "Remove moderator" : "Make moderator"}
                  </ActionButton>
                  <ActionButton
                    action={removeCommunityMember.bind(null, group.id, user.id)}
                    variant="ghost"
                    label={`Remove ${displayName(user)}`}
                    confirm={{ title: `Remove ${displayName(user)}?`, body: "They can join again if the community is open.", confirmLabel: "Remove", danger: true }}
                  >
                    <IconTrash size={14} />
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
