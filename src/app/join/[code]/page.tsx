import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { JoinButton } from "@/components/organiser/JoinButton";
import { OrganiserLogo } from "@/components/organiser/OrganiserStatus";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCurrentUser } from "@/lib/auth";
import { INVITE_PROBLEM_COPY, inviteProblem, isValidInviteCode } from "@/lib/organiser/invites";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join a team", robots: { index: false, follow: false } };

type Peek = {
  organiser_id: string;
  organiser_name: string;
  organiser_slug: string;
  logo_url: string | null;
  org_status: string;
  role: string;
  expires_at: string;
  max_uses: number;
  uses: number;
  revoked: boolean;
  already_member: boolean;
};

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-5 py-10">
      <Suspense fallback={<Skeleton className="h-80 w-full rounded-[28px]" />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/join/[code]">["params"] }) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${code}`)}`);

  let invite: Peek | null = null;
  if (isValidInviteCode(code)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("peek_organiser_invite", { p_code: code });
    invite = ((data ?? []) as Peek[])[0] ?? null;
  }
  const problem = invite ? inviteProblem({ ...invite }) : null;

  return (
    <div className="glass-strong w-full rounded-[28px] p-6 text-center">
      <div className="-mt-2 flex justify-center"><OrbitEmblem size={72} /></div>
      {!invite ? (
        <Message title="This invite link isn't valid" body="Check the link with the person who sent it." />
      ) : invite.already_member ? (
        <>
          <Org invite={invite} />
          <p className="mt-5 text-sm text-muted">You&apos;re already on this team.</p>
          <ButtonLink href={`/organiser?org=${invite.organiser_id}`} size="lg" full className="mt-5">Open Studio</ButtonLink>
        </>
      ) : problem ? (
        <>
          <Org invite={invite} />
          <Message title={INVITE_PROBLEM_COPY[problem].title} body={INVITE_PROBLEM_COPY[problem].body} />
        </>
      ) : (
        <>
          <Org invite={invite} />
          <p className="mt-4 text-sm text-muted">
            You&apos;ve been invited to help run events as an <strong className="font-semibold text-fg">editor</strong>:
            create events, manage guests and check people in.
          </p>
          <div className="mt-6">
            <JoinButton code={code} orgName={invite.organiser_name} />
          </div>
        </>
      )}
      <Link href="/" className="mt-4 inline-block text-sm text-muted underline-offset-4 hover:text-fg hover:underline">Not now</Link>
    </div>
  );
}

function Org({ invite }: { invite: Peek }) {
  return (
    <div className="mt-3 flex flex-col items-center">
      <OrganiserLogo src={invite.logo_url} name={invite.organiser_name} size={64} />
      <p className="mt-4 font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-subtle">Team invite</p>
      <h1 className="mt-1.5 text-2xl font-semibold leading-tight">{invite.organiser_name}</h1>
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-5">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
    </div>
  );
}
