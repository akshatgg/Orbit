import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { joinGroup, leaveGroup, respondInvite } from "@/lib/social/actions";
import { displayName, timeAgo } from "@/lib/social/format";
import type { GroupDetail, GroupInviteRow } from "@/types/social";
import { InviteByEmailForm, InviteLinkButton } from "./CircleForms";
import { SocialIcon } from "./icons";
import { ActionButton } from "./SmallActions";

/** Moderators of a community or channel: people asking to join, to approve or decline. */
export function JoinRequests({ groupId, requests }: { groupId: string; requests: GroupInviteRow[] }) {
  if (requests.length === 0) return null;
  return (
    <section aria-labelledby="join-requests" className="space-y-2">
      <h2 id="join-requests" className="text-sm font-semibold tracking-tight">Join requests</h2>
      <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
        {requests.map((r) => {
          const person = r.user ?? r.invited_user ?? r.invited_by ?? null;
          return (
            <li key={r.id} className="flex items-center gap-2.5 px-4 py-3">
              <Avatar src={person?.avatar_url} name={displayName(person)} size={32} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{displayName(person)}</span>
              <ActionButton action={respondInvite.bind(null, groupId, r.id, true)} variant="primary">Approve</ActionButton>
              <ActionButton action={respondInvite.bind(null, groupId, r.id, false)} label="Decline request">
                <SocialIcon name="x" className="h-3.5 w-3.5" />
              </ActionButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Moderators: a join link (made on first click), an email invite as member or moderator, and the
 * invites still waiting for an answer.
 */
export function InvitePeople({ group, invites }: { group: GroupDetail; invites: GroupInviteRow[] }) {
  return (
    <section aria-labelledby="invite-people" className="glass space-y-4 rounded-[22px] p-4">
      <h2 id="invite-people" className="text-sm font-semibold tracking-tight">Invite people</h2>
      <div className="space-y-2">
        <p className="text-xs text-muted">
          {group.visibility === "public"
            ? "Anyone with the link can join. Links last 14 days."
            : "Anyone with the link joins straight away, without approval. Links last 14 days."}
        </p>
        <InviteLinkButton groupId={group.id} groupName={group.name} />
      </div>
      <div className="border-t border-line pt-4">
        <InviteByEmailForm groupId={group.id} roles />
      </div>
      {invites.length > 0 && (
        <div className="border-t border-line pt-4">
          <h3 className="text-xs font-semibold text-muted">Waiting for an answer</h3>
          <ul className="mt-2 space-y-2.5">
            {invites.map((invite) => {
              const person = invite.user ?? invite.invited_user ?? null;
              const name = person ? displayName(person) : invite.email ?? "Invite";
              return (
                <li key={invite.id} className="flex items-center gap-2.5 text-sm">
                  <Avatar src={person?.avatar_url} name={name} size={28} />
                  <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
                  {invite.role === "admin" && <Badge tone="brand">Moderator</Badge>}
                  <span className="shrink-0 text-xs text-subtle">{timeAgo(invite.created_at)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

/**
 * Where the viewer stands: invited (accept / decline), in it (Leave, where `can_leave` allows),
 * asked already, or Join / Request. `leaveNote` warns what else goes with it; `leaveTo` is where a
 * person lands when the page they're on is about to close to them.
 */
export function Membership({ group, leaveNote, leaveTo }: { group: GroupDetail; leaveNote?: string; leaveTo?: string }) {
  const word = group.kind === "channel" ? "channel" : "community";
  if (!group.my_role && group.pending_invite) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted">You&apos;re invited</span>
        <ActionButton action={respondInvite.bind(null, group.id, group.pending_invite.id, true)} variant="primary">Accept</ActionButton>
        <ActionButton action={respondInvite.bind(null, group.id, group.pending_invite.id, false)} variant="secondary">Decline</ActionButton>
      </div>
    );
  }
  if (group.my_role) {
    return (
      <div className="flex items-center gap-2">
        <Badge tone="success" className="h-8 px-3 text-xs">Joined</Badge>
        {group.can_leave !== false && (
          <ActionButton action={leaveGroup.bind(null, group.id, leaveTo)} confirm={`Leave ${group.name}?${leaveNote ? ` ${leaveNote}` : ""}`} variant="secondary">
            Leave
          </ActionButton>
        )}
      </div>
    );
  }
  if (group.pending_request) return <Badge tone="warning" className="h-8 px-3 text-xs">Request sent</Badge>;
  if (group.visibility === "private" && !group.can_manage) return <Badge className="h-8 px-3 text-xs">Invite only</Badge>;
  return (
    <ActionButton action={joinGroup.bind(null, group.id)} variant="primary" size="md">
      {group.visibility === "approval" && !group.can_manage ? "Request to join" : `Join ${word}`}
    </ActionButton>
  );
}
