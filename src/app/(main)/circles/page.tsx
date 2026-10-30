import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AvatarStack } from "@/components/social/AvatarStack";
import { CreateCircleForm } from "@/components/social/CircleForms";
import { SocialIcon } from "@/components/social/icons";
import { ActionButton } from "@/components/social/SmallActions";
import { CirclesSkeleton } from "@/components/social/Skeletons";
import { SocialTabs } from "@/components/social/SocialTabs";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireProfile } from "@/lib/auth";
import { respondInvite } from "@/lib/social/actions";
import { displayName, plural, timeAgo } from "@/lib/social/format";
import { listMyGroups, listMyInvites } from "@/lib/social/queries";
import type { GroupCard, MyInvite } from "@/types/social";

export const metadata: Metadata = { title: "Circles" };

export default function CirclesPage() {
  return (
    <>
      <PageHeader title="Circles" subtitle="Small groups of friends: share events, see who's in, plan together." />
      <SocialTabs />
      <Suspense fallback={<CirclesSkeleton />}>
        <Circles />
      </Suspense>
    </>
  );
}

async function Circles() {
  await requireProfile();
  const [circles, invites] = await Promise.all([listMyGroups("circle"), listMyInvites()]);

  return (
    <div className="space-y-8 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-8 md:space-y-0 md:px-4">
      <div className="space-y-8">
        {invites.length > 0 && <Invites invites={invites} />}
        <section aria-labelledby="my-circles">
          <h2 id="my-circles" className="mb-3 px-4 text-lg font-semibold tracking-tight md:px-0">
            Your circles
            {circles.length > 0 && <span className="ml-2 align-middle text-xs font-medium text-muted">{circles.length}</span>}
          </h2>
          {circles.length === 0 ? (
            <div className="md:[&>div]:mx-0">
              <EmptyState title="No circles yet">
                Start one for your flatmates or course friends, then share events and see who&apos;s in.
              </EmptyState>
            </div>
          ) : (
            <ul className="space-y-3 px-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 md:px-0">
              {circles.map((c) => <li key={c.id}><CircleRow circle={c} /></li>)}
            </ul>
          )}
        </section>
      </div>
      <aside id="new" className="px-4 md:sticky md:top-24 md:px-0">
        <CreateCircleForm autoFocus={circles.length === 0 && invites.length === 0} />
      </aside>
    </div>
  );
}

function Invites({ invites }: { invites: MyInvite[] }) {
  return (
    <section aria-labelledby="invites" className="px-4 md:px-0">
      <h2 id="invites" className="mb-3 text-lg font-semibold tracking-tight">
        Invites
        <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 align-middle text-[11px] font-semibold text-white">{invites.length}</span>
      </h2>
      <ul className="space-y-2.5">
        {invites.map((invite) => (
          <li key={invite.id} className="glass flex flex-wrap items-center gap-3 rounded-[20px] p-3.5">
            <Avatar src={invite.invited_by?.avatar_url} name={displayName(invite.invited_by)} size={38} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug">
                <span className="font-medium">{displayName(invite.invited_by)}</span> invited you to{" "}
                <span className="font-semibold">{invite.group.name}</span>
              </p>
              <p className="mt-0.5 text-xs text-muted">{invite.group.kind === "channel" ? `Channel${invite.group.parent_name ? ` in ${invite.group.parent_name}` : ""}` : invite.group.kind === "community" ? "Community" : "Circle"} · {timeAgo(invite.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <ActionButton action={respondInvite.bind(null, invite.group.id, invite.id, true)} variant="primary">Accept</ActionButton>
              <ActionButton action={respondInvite.bind(null, invite.group.id, invite.id, false)} variant="secondary">Decline</ActionButton>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CircleRow({ circle }: { circle: GroupCard }) {
  const upcoming = circle.upcoming_event_count ?? 0;
  return (
    <Link
      href={`/circles/${circle.id}`}
      className="glass group flex h-full items-center gap-3 rounded-[22px] p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-ink/[0.07] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent/10 text-accent">
        <SocialIcon name="circles" className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold tracking-tight">{circle.name}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {plural(circle.member_count, "member")}
          {" · "}
          {upcoming ? <span className="font-medium text-accent">{plural(upcoming, "upcoming event")}</span> : "No upcoming events"}
        </span>
        {circle.members_preview && circle.members_preview.length > 0 && (
          <span className="mt-2 block">
            <AvatarStack users={circle.members_preview} total={circle.member_count} size={22} />
          </span>
        )}
      </span>
      <SocialIcon name="chevron" className="h-4 w-4 text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
