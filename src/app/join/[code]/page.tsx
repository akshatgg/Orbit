import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { JoinButton } from "@/components/organiser/JoinButton";
import { OrganiserLogo } from "@/components/organiser/OrganiserStatus";
import { ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { isApiStatus } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import { getCurrentUser } from "@/lib/auth";
import { INVITE_PROBLEM_COPY, isValidInviteCode, type InviteProblem } from "@/lib/organiser/invites";

export const metadata: Metadata = { title: "Join a team", robots: { index: false, follow: false } };

/** `GET /invites/{code}`: 404 only for an unknown code; a dead one says why in `reason`. */
type Peek = {
  organiser: { id: string; name: string; slug: string; logo_url: string | null; status: string };
  role: string;
  expires_at: string;
  revoked: boolean;
  max_uses: number;
  uses: number;
  uses_left: number;
  already_member: boolean;
  valid: boolean;
  reason: "revoked" | "expired" | "used_up" | "org_inactive" | null;
};

const PROBLEM: Record<NonNullable<Peek["reason"]>, InviteProblem> = {
  revoked: "revoked", expired: "expired", used_up: "full", org_inactive: "org_inactive",
};

async function peekInvite(code: string): Promise<Peek | null> {
  if (!isValidInviteCode(code)) return null;
  try {
    return await authed.get<Peek>(`/invites/${encodeURIComponent(code)}`);
  } catch (error) {
    if (isApiStatus(error, 404, 422)) return null;
    throw error;
  }
}

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

  const invite = await peekInvite(code);
  const problem = invite && !invite.valid ? PROBLEM[invite.reason ?? "revoked"] : null;

  return (
    <div className="glass-strong w-full rounded-[28px] p-6 text-center">
      <div className="-mt-2 flex justify-center"><OrbitEmblem size={72} /></div>
      {!invite ? (
        <Message title="This invite link isn't valid" body="Check the link with the person who sent it." />
      ) : invite.already_member ? (
        <>
          <Org invite={invite} />
          <p className="mt-5 text-sm text-muted">You&apos;re already on this team.</p>
          <ButtonLink href={`/organiser?org=${invite.organiser.id}`} size="lg" full className="mt-5">Open Studio</ButtonLink>
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
            <JoinButton code={code} orgName={invite.organiser.name} />
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
      <OrganiserLogo src={invite.organiser.logo_url} name={invite.organiser.name} size={64} />
      <p className="mt-4 font-display text-xs font-medium text-muted">Team invite</p>
      <h1 className="mt-1.5 text-2xl font-semibold leading-tight">{invite.organiser.name}</h1>
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
