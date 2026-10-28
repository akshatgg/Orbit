import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { removeMember, setMemberRole, startDirectMessage } from "@/lib/social/actions";
import { displayName } from "@/lib/social/format";
import type { GroupMemberRow } from "@/types/social";
import { SocialIcon } from "./icons";
import { ActionButton } from "./SmallActions";

/** Members with "Message" (DMs need a shared group) and, for admins, make admin / remove. */
export function MemberList({ groupId, members, viewerId, canManage, kind = "circle" }: {
  groupId: string;
  members: GroupMemberRow[];
  viewerId: string;
  canManage: boolean;
  kind?: "circle" | "community";
}) {
  return (
    <section aria-labelledby={`members-${groupId}`}>
      <h2 id={`members-${groupId}`} className="mb-2 text-sm font-semibold tracking-tight">
        Members <span className="ml-1 text-xs font-medium text-muted">{members.length}</span>
      </h2>
      <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
        {members.map(({ user, role }) => {
          const me = user.id === viewerId;
          const name = displayName(user);
          return (
            <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar src={user.avatar_url} name={name} size={38} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium">
                  {name}
                  {me && <span className="font-normal text-muted">(you)</span>}
                  {role === "admin" && <Badge tone="brand">{kind === "community" ? "Moderator" : "Admin"}</Badge>}
                </span>
                {user.university && <span className="block truncate text-xs text-muted">{user.university}</span>}
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
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
