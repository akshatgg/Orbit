import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { getCurrentUser } from "@/lib/auth";
import { displayName, groupPath, plural } from "@/lib/social/format";
import { previewInvite } from "@/lib/social/queries";
import type { GroupKind } from "@/types/social";
import { JoinGroupButton } from "./JoinGroupButton";

const VALID_CODE = /^[\w-]{4,80}$/;

const COPY: Record<GroupKind, { eyebrow: string; join: string; ask: string; home: { href: string; label: string } }> = {
  circle: {
    eyebrow: "Circle invite",
    join: "Join circle",
    ask: "Ask a member of the circle for a new one.",
    home: { href: "/circles", label: "Your circles" },
  },
  community: {
    eyebrow: "Community invite",
    join: "Join community",
    ask: "Ask one of the community's moderators for a new one.",
    home: { href: "/communities", label: "Browse communities" },
  },
  channel: {
    eyebrow: "Channel invite",
    join: "Join channel",
    ask: "Ask one of the channel's moderators for a new one.",
    home: { href: "/communities", label: "Browse communities" },
  },
};

/** The centred card the invite pages (and their loading state) sit in. */
export function JoinFrame({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 py-10">{children}</main>;
}

/**
 * `/join/circle/<code>`, `/join/community/<code>` and `/join/channel/<code>`: what the link opens and who sent it, then
 * "Join". Signed-out visitors sign in first and come back; a link to the other kind of group moves
 * to its own page. Call inside a <Suspense> boundary.
 */
export async function JoinInvite({ code, kind }: { code: string; kind: GroupKind }) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${kind}/${code}`)}`);

  const lookup = VALID_CODE.test(code) ? await previewInvite(code) : { problem: "" };
  const preview = "preview" in lookup ? lookup.preview : null;
  const group = preview
    ? {
        id: preview.group?.id ?? preview.group_id ?? preview.id ?? "",
        kind: preview.group?.kind ?? preview.kind ?? kind,
        name: preview.group?.name ?? preview.name ?? (kind === "circle" ? "A circle" : `A ${kind}`),
        slug: preview.group?.slug ?? null,
        description: preview.group?.description ?? preview.description ?? null,
        members: preview.group?.member_count ?? preview.member_count,
        visibility: preview.group?.visibility,
        parent_slug: preview.group?.parent_slug ?? null,
        parent_name: preview.group?.parent_name ?? null,
      }
    : null;
  if (group && group.kind !== kind) redirect(`/join/${group.kind}/${encodeURIComponent(code)}`);

  const copy = COPY[kind];
  const problem = "problem" in lookup && lookup.problem && /\s/.test(lookup.problem) ? lookup.problem : "";
  const expired = /expired/i.test(problem);
  const openHref = group ? groupPath(group) : copy.home.href;

  return (
    <div className="glass-strong w-full rounded-[28px] p-6 text-center">
      <div className="-mt-2 flex justify-center"><OrbitEmblem size={72} /></div>
      {!group ? (
        <div className="mt-5">
          <h1 className="text-xl font-semibold">{expired ? "This invite link has expired" : "This invite link isn't valid"}</h1>
          <p className="mt-2 text-sm text-muted">{expired ? `Invite links work for 14 days. ${copy.ask}` : problem || `It may have expired. ${copy.ask}`}</p>
          <ButtonLink href={copy.home.href} variant="secondary" size="lg" full className="mt-6">{copy.home.label}</ButtonLink>
        </div>
      ) : (
        <>
          <p className="mt-3 font-display text-xs font-medium text-muted">{copy.eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-semibold leading-tight">{group.name}</h1>
          {group.parent_name && <p className="mt-1 text-sm text-muted">In {group.parent_name}</p>}
          {group.description && <p className="mt-2 line-clamp-4 text-sm text-muted">{group.description}</p>}
          {preview?.invited_by && (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted">
              <Avatar src={preview.invited_by.avatar_url} name={displayName(preview.invited_by)} size={24} />
              {displayName(preview.invited_by)} invited you
            </p>
          )}
          {group.members !== undefined && <p className="mt-2 text-xs text-subtle">{plural(group.members, "member")}</p>}
          <div className="mt-6">
            {preview?.already_member ? (
              <>
                <p className="mb-4 text-sm text-muted">You&apos;re already in this {group.kind}.</p>
                <ButtonLink href={openHref} size="lg" full>Open {group.kind}</ButtonLink>
              </>
            ) : (
              <>
                {kind !== "circle" && group.visibility && group.visibility !== "public" && (
                  <p className="mb-4 text-xs text-muted">This link lets you in straight away, without waiting for approval.</p>
                )}
                {group.parent_name && <p className="mb-4 text-xs text-muted">Joining also adds you to {group.parent_name}.</p>}
                <JoinGroupButton code={code} name={group.name} label={copy.join} />
              </>
            )}
          </div>
        </>
      )}
      <Link href="/" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-fg hover:underline">Not now</Link>
    </div>
  );
}
