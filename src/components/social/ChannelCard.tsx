import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { joinGroup } from "@/lib/social/actions";
import { groupCategories, groupPath, plural, timeAgo } from "@/lib/social/format";
import type { ChannelCard as Channel } from "@/types/social";
import { SocialIcon, type SocialIconName } from "./icons";
import { ActionButton } from "./SmallActions";

function channelIcon(channel: Channel): SocialIconName {
  if (channel.is_announcements) return "megaphone";
  return channel.visibility === "private" ? "lock" : "chat";
}

/** Unread messages in a channel I'm in (the nav's badge leaves channels out on purpose). */
export function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span aria-label={plural(count, "unread message")} className="shrink-0 rounded-full bg-accent px-1.5 text-[10.5px] font-semibold leading-[18px] text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/** One-tap Join, or Request where a moderator decides; "Request sent" while one is waiting. */
export function ChannelJoin({ channel }: { channel: Channel }) {
  if (channel.my_role) return null;
  if (channel.pending_request) return <Badge tone="warning">Request sent</Badge>;
  const approval = channel.visibility === "approval";
  return (
    <ActionButton
      action={joinGroup.bind(null, channel.id)}
      variant={approval ? "secondary" : "primary"}
      label={`${approval ? "Ask to join" : "Join"} ${channel.name}`}
      done={approval ? <Badge tone="warning">Request sent</Badge> : <Badge tone="success">Joined</Badge>}
    >
      {approval ? "Request" : "Join"}
    </ActionButton>
  );
}

/** What a row says under the name: for a member the latest message, for anyone else what it's about. */
function channelLine(channel: Channel) {
  return channel.my_role ? channel.last_message_preview || channel.description : channel.description;
}

function Footer({ channel }: { channel: Channel }) {
  return (
    <span className="text-xs text-muted">
      {plural(channel.member_count, "member")}
      {channel.upcoming_event_count > 0 && <span className="font-medium text-accent"> · {plural(channel.upcoming_event_count, "upcoming event")}</span>}
    </span>
  );
}

/** A channel as a card. The name's link covers the card; Join sits above it. */
export function ChannelItem({ channel }: { channel: Channel }) {
  const line = channelLine(channel);
  return (
    <article className="glass relative flex h-full flex-col rounded-[22px] p-4 transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-ink/[0.07] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-accent/10 text-accent">
          <SocialIcon name={channelIcon(channel)} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2">
            <Link href={groupPath(channel)} className="min-w-0 flex-1 truncate font-semibold leading-snug tracking-tight after:absolute after:inset-0 after:rounded-[22px]">
              {channel.name}
            </Link>
            <UnreadBadge count={channel.unread_count} />
          </h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {groupCategories(channel).slice(0, 2).map((c) => <Badge key={c.id || c.name} tone="brand">{c.name}</Badge>)}
            {groupCategories(channel).length > 2 && <Badge tone="brand">+{groupCategories(channel).length - 2}</Badge>}
            {channel.visibility === "approval" && !channel.my_role && <Badge tone="warning">Approval</Badge>}
            {channel.visibility === "private" && <Badge>Private</Badge>}
            {channel.post_policy === "moderators" && <Badge>Moderators post</Badge>}
          </div>
        </div>
      </div>
      {line && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">{line}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <Footer channel={channel} />
        <span className="relative z-10"><ChannelJoin channel={channel} /></span>
      </div>
    </article>
  );
}

/** The same channel as one row of the list view (inside a divided `glass` list). */
export function ChannelRow({ channel }: { channel: Channel }) {
  const line = channelLine(channel);
  return (
    <article className="relative flex items-center gap-3 px-4 py-3 transition-colors duration-200 hover:bg-ink/[0.04] motion-reduce:transition-none">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <SocialIcon name={channelIcon(channel)} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="flex items-center gap-2">
          <Link href={groupPath(channel)} className="min-w-0 truncate text-[15px] font-semibold leading-snug tracking-tight after:absolute after:inset-0">
            {channel.name}
          </Link>
          {channel.last_message_at && <time dateTime={channel.last_message_at} className="shrink-0 text-[11px] text-subtle">{timeAgo(channel.last_message_at)}</time>}
        </h3>
        {line ? <p className="mt-0.5 truncate text-xs text-muted">{line}</p> : <p className="mt-0.5 text-xs text-muted">{plural(channel.member_count, "member")}</p>}
      </div>
      <UnreadBadge count={channel.unread_count} />
      <span className="relative z-10 shrink-0"><ChannelJoin channel={channel} /></span>
    </article>
  );
}

/** Announcements, pinned above the sections: a row whatever the layout. */
export function PinnedChannel({ channel }: { channel: Channel }) {
  return (
    <div className="glass overflow-hidden rounded-[22px]">
      <ChannelRow channel={channel} />
    </div>
  );
}

/** The channels beside a chat from `md` up: Announcements, mine, then the rest. */
export function ChannelSidebar({ community, name, channels, active }: { community: string; name: string; channels: Channel[]; active: string }) {
  const mine = channels.filter((c) => c.my_role || c.is_announcements);
  const others = channels.filter((c) => !c.my_role && !c.is_announcements);
  return (
    <nav aria-label={`Channels in ${name}`} className="space-y-4">
      <Link href={`/communities/${community}`} className="block truncate px-3 text-sm font-semibold tracking-tight hover:text-accent">{name}</Link>
      <SidebarList channels={mine} active={active} />
      {others.length > 0 && (
        <div>
          <p className="mb-1 px-3 text-xs font-medium text-muted">More channels</p>
          <SidebarList channels={others} active={active} />
        </div>
      )}
    </nav>
  );
}

function SidebarList({ channels, active }: { channels: Channel[]; active: string }) {
  return (
    <ul className="space-y-0.5">
      {channels.map((c) => {
        const on = c.id === active || c.slug === active;
        return (
          <li key={c.id}>
            <Link
              href={groupPath(c)}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-[14px] px-3 py-2 transition-colors ${on ? "bg-ink/[0.09] text-fg" : "text-muted hover:bg-ink/[0.05] hover:text-fg"}`}
            >
              <SocialIcon name={channelIcon(c)} className="h-4 w-4" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{c.name}</span>
                {c.my_role && c.last_message_preview && <span className="block truncate text-xs text-subtle">{c.last_message_preview}</span>}
              </span>
              {/* What's open is being read. */}
              {!on && <UnreadBadge count={c.unread_count} />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
