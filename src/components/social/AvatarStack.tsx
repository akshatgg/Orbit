import { Avatar } from "@/components/ui/Avatar";
import { displayName } from "@/lib/social/format";
import type { SocialUser } from "@/types/social";

/** Overlapping avatars (fixed size, no layout shift) with a "+N" chip past `max`. */
export function AvatarStack({ users, max = 5, size = 26, total }: { users: SocialUser[]; max?: number; size?: number; total?: number }) {
  if (!users.length) return null;
  const shown = users.slice(0, max);
  const rest = (total ?? users.length) - shown.length;
  return (
    <span className="flex items-center" title={users.map((u) => displayName(u)).join(", ")}>
      {shown.map((u, i) => (
        <span key={u.id} className={`rounded-full ring-2 ring-bg ${i ? "-ml-2" : ""}`}>
          <Avatar src={u.avatar_url} name={displayName(u)} size={size} />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{ height: size, minWidth: size }}
          className="-ml-2 inline-flex items-center justify-center rounded-full bg-ink/[0.1] px-1.5 text-[10.5px] font-semibold text-muted ring-2 ring-bg"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
