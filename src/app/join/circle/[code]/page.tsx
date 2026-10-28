import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { JoinCircleButton } from "@/components/social/JoinCircleButton";
import { Avatar } from "@/components/ui/Avatar";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCurrentUser } from "@/lib/auth";
import { displayName, plural } from "@/lib/social/format";
import { previewInvite } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Join a circle", robots: { index: false, follow: false } };

const VALID_CODE = /^[\w-]{4,80}$/;

export default function JoinCirclePage({ params }: PageProps<"/join/circle/[code]">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 py-10">
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-[28px]" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/join/circle/[code]">["params"] }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/circle/${code}`)}`);

  const lookup = VALID_CODE.test(code) ? await previewInvite(code) : { problem: "" };
  const preview = "preview" in lookup ? lookup.preview : null;
  const group = preview
    ? {
        id: preview.group?.id ?? preview.group_id ?? preview.id ?? "",
        name: preview.group?.name ?? preview.name ?? "A circle",
        kind: preview.group?.kind ?? preview.kind ?? "circle",
        description: preview.group?.description ?? preview.description ?? null,
        members: preview.group?.member_count ?? preview.member_count,
      }
    : null;
  const openHref = group ? (group.kind === "community" ? `/communities/${group.id}` : `/circles/${group.id}`) : "/circles";

  return (
    <div className="glass-strong w-full rounded-[28px] p-6 text-center">
      <div className="-mt-2 flex justify-center"><OrbitEmblem size={72} /></div>
      {!group ? (
        <div className="mt-5">
          <h1 className="text-xl font-semibold">This invite link isn&apos;t valid</h1>
          <p className="mt-2 text-sm text-muted">
            {"problem" in lookup && lookup.problem && /\s/.test(lookup.problem) ? lookup.problem : "It may have expired. Ask a member of the circle for a new one."}
          </p>
          <ButtonLink href="/circles" variant="secondary" size="lg" full className="mt-6">Your circles</ButtonLink>
        </div>
      ) : (
        <>
          <p className="mt-3 font-display text-xs font-medium text-muted">{group.kind === "community" ? "Community invite" : "Circle invite"}</p>
          <h1 className="mt-1.5 text-2xl font-semibold leading-tight">{group.name}</h1>
          {group.description && <p className="mt-2 text-sm text-muted">{group.description}</p>}
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
                <ButtonLink href={openHref} size="lg" full>Open it</ButtonLink>
              </>
            ) : (
              <JoinCircleButton code={code} name={group.name} />
            )}
          </div>
        </>
      )}
      <Link href="/" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-fg hover:underline">Not now</Link>
    </div>
  );
}
