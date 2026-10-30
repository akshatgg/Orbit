import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { groupCategories, plural } from "@/lib/social/format";
import type { GroupCard } from "@/types/social";
import { AvatarStack } from "./AvatarStack";
import { SocialIcon } from "./icons";
import { OrganiserByline } from "./OrganiserByline";

/** A community in the directory: name, categories, university, size, upcoming events, joined state. */
export function CommunityCard({ community }: { community: GroupCard }) {
  const joined = !!community.my_role;
  return (
    <Link
      href={`/communities/${community.slug ?? community.id}`}
      className="glass group flex h-full flex-col rounded-[22px] p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-ink/[0.07] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <span className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent/10 text-accent">
          <SocialIcon name="community" className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold leading-snug tracking-tight">{community.name}</span>
          {community.organiser && <OrganiserByline organiser={community.organiser} plain className="mt-0.5" />}
          <span className="mt-1 flex flex-wrap gap-1.5">
            {joined && <Badge tone="success">Joined</Badge>}
            {groupCategories(community).slice(0, 3).map((c) => <Badge key={c.id || c.name} tone="brand">{c.name}</Badge>)}
            {groupCategories(community).length > 3 && <Badge tone="brand">+{groupCategories(community).length - 3}</Badge>}
            {community.university && <Badge>{community.university}</Badge>}
            <AccessBadge community={community} />
          </span>
        </span>
      </span>
      {community.description && <span className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{community.description}</span>}
      <span className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-muted">
        <span className="flex items-center gap-2">
          {community.members_preview && community.members_preview.length > 0 && (
            <AvatarStack users={community.members_preview} total={community.member_count} size={20} max={3} />
          )}
          {plural(community.member_count, "member")}
        </span>
        {community.upcoming_event_count > 0 && <span className="font-medium text-accent">{plural(community.upcoming_event_count, "upcoming event")}</span>}
      </span>
    </Link>
  );
}

/** The same community as one row of the directory's list view (inside a divided `glass` list). */
export function CommunityRow({ community }: { community: GroupCard }) {
  const joined = !!community.my_role;
  const categories = groupCategories(community);
  return (
    <Link
      href={`/communities/${community.slug ?? community.id}`}
      className="flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.04] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <SocialIcon name="community" className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold leading-snug tracking-tight">{community.name}</span>
        {community.organiser && <OrganiserByline organiser={community.organiser} plain />}
        <span className="mt-1 flex flex-wrap gap-1">
          {joined && <Badge tone="success">Joined</Badge>}
          {/* One category (+N) on phones, two from `sm`, so a row stays two lines. */}
          {categories[0] && <Badge tone="brand">{categories[0].name}</Badge>}
          {categories[1] && <span className="hidden sm:contents"><Badge tone="brand">{categories[1].name}</Badge></span>}
          {categories.length > 1 && <span className="contents sm:hidden"><Badge tone="brand">+{categories.length - 1}</Badge></span>}
          {categories.length > 2 && <span className="hidden sm:contents"><Badge tone="brand">+{categories.length - 2}</Badge></span>}
          <AccessBadge community={community} />
        </span>
      </span>
      <span className="shrink-0 text-right text-xs leading-relaxed text-muted">
        <span className="block tabular-nums">{plural(community.member_count, "member")}</span>
        {community.upcoming_event_count > 0 && (
          <span className="block font-medium tabular-nums text-accent">{community.upcoming_event_count} upcoming</span>
        )}
      </span>
      <SocialIcon name="chevron" className="hidden h-4 w-4 text-subtle sm:block" />
    </Link>
  );
}

function AccessBadge({ community }: { community: GroupCard }) {
  if (community.visibility === "approval" && !community.my_role) return <Badge tone="warning">Approval</Badge>;
  if (community.visibility === "private") return <Badge>Private</Badge>;
  return null;
}
