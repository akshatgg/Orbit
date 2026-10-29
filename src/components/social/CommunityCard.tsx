import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { groupCategories, plural } from "@/lib/social/format";
import type { GroupCard } from "@/types/social";
import { AvatarStack } from "./AvatarStack";
import { SocialIcon } from "./icons";

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
          <span className="mt-1 flex flex-wrap gap-1.5">
            {joined && <Badge tone="success">Joined</Badge>}
            {groupCategories(community).slice(0, 3).map((c) => <Badge key={c.id || c.name} tone="brand">{c.name}</Badge>)}
            {groupCategories(community).length > 3 && <Badge tone="brand">+{groupCategories(community).length - 3}</Badge>}
            {community.university && <Badge>{community.university}</Badge>}
            {community.visibility === "approval" && !joined && <Badge tone="warning">Approval</Badge>}
            {community.visibility === "private" && <Badge>Private</Badge>}
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
