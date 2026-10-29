import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { removeMember, setMemberRole, startDirectMessage } from "@/lib/social/actions";
import { adminsFirst, displayName } from "@/lib/social/format";
import type { GroupMemberRow } from "@/types/social";
import { SocialIcon } from "./icons";
import { ActionButton } from "./SmallActions";

/**
 * Members, admins (moderators) first, with "Message" (DMs need a shared group) and, for admins,
 * make admin / remove, and "Step down" on their own row while another admin remains.
 */
export function MemberList({ groupId, members, viewerId, canManage, kind = "circle", total, adminCount }: {
  groupId: string;
  members: GroupMemberRow[];
  viewerId: string;
  canManage: boolean;
  kind?: "circle" | "community";
  /** Everyone in the group, when `members` is only the first few. */
  total?: number;
  /** Admins in the whole group, when `members` is only the first few. */
  adminCount?: number;
}) {
  const admins = adminCount ?? members.filter((m) => m.role === "admin").length;
  const adminWord = kind === "community" ? "moderator" : "admin";
  return (
    <section aria-labelledby={`members-${groupId}`}>
      <h2 id={`members-${groupId}`} className="mb-2 text-sm font-semibold tracking-tight">
        Members <span className="ml-1 text-xs font-medium text-muted">{total ?? members.length}</span>
      </h2>
      <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
        {adminsFirst(members).map(({ user, role }) => {
          const me = user.id === viewerId;
          const name = displayName(user);
          return (
            <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar src={user.avatar_url} name={name} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                  <span className="truncate">{name}</span>
                  {me && <span className="shrink-0 font-normal text-muted">(you)</span>}
                </span>
                {(role === "admin" || user.university) && (
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                    {role === "admin" && <Badge tone="brand" className="shrink-0">{kind === "community" ? "Moderator" : "Admin"}</Badge>}
                    {user.university && <span className="truncate">{user.university}</span>}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1">
                {!me && (
                  <ActionButton action={startDirectMessage.bind(null, user.id)} variant="secondary" label={`Message ${name}`}>
                    <SocialIcon name="chat" className="h-3.5 w-3.5" /> Message
                  </ActionButton>
                )}
                {canManage && !me && (
                  <ActionButton
                    action={setMemberRole.bind(null, groupId, user.id, role === "admin" ? "member" : "admin")}
                    label={role === "admin" ? `Make ${name} a member` : `Make ${name} ${kind === "community" ? "a moderator" : "an admin"}`}
                  >
                    {role === "admin" ? "Unmake" : kind === "community" ? "Make mod" : "Make admin"}
                  </ActionButton>
                )}
                {canManage && !me && (
                  <ActionButton action={removeMember.bind(null, groupId, user.id)} confirm={`Remove ${name}?`} label={`Remove ${name}`}>
                    Remove
                  </ActionButton>
                )}
                {me && role === "admin" && admins > 1 && (
                  <ActionButton
                    action={setMemberRole.bind(null, groupId, user.id, "member")}
                    confirm={`Step down as ${adminWord}? You'll stay a member, and another ${adminWord} can make you one again.`}
                    label={`Stop being a ${adminWord}`}
                  >
                    Step down
                  </ActionButton>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
