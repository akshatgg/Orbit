import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { ProfileForm } from "@/components/organiser/ProfileForm";
import { TeamPanel } from "@/components/organiser/TeamPanel";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getMyOrganisers, requireUser } from "@/lib/auth";
import { pickOrganiser } from "@/lib/organiser/dashboard";
import { listTeam } from "@/lib/organiser/queries";

export const metadata: Metadata = { title: "Organiser settings" };

export default function SettingsPage({ searchParams }: PageProps<"/organiser/settings">) {
  return (
    <>
      <PageHeader back={<BackLink href="/organiser" label="Studio" />} title="Settings" subtitle="Your public profile and team" />
      <Suspense fallback={<div className="space-y-4 px-4"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/organiser/settings">["searchParams"] }) {
  const user = await requireUser();
  const [orgs, params] = await Promise.all([getMyOrganisers(), searchParams]);
  const org = pickOrganiser(orgs, params.org, false);
  if (!org) {
    return <EmptyState title="No organiser yet" action={<ButtonLink href="/organiser/apply">Become an organiser</ButtonLink>}>Apply to start publishing events.</EmptyState>;
  }
  const team = await listTeam(org.id);

  return (
    <div className="space-y-8 px-4">
      {orgs.length > 1 && (
        <nav aria-label="Switch organiser" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {orgs.map((o) => (
            <Link key={o.id} href={`/organiser/settings?org=${o.id}`} aria-current={o.id === org.id ? "page" : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm ${o.id === org.id ? "border-gradient text-fg" : "border-line text-muted hover:text-fg"}`}>
              {o.name}
            </Link>
          ))}
        </nav>
      )}

      <section aria-labelledby="profile-h" className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 id="profile-h" className="font-display text-lg font-semibold">Profile</h2>
          <Link href={`/o/${org.slug}`} className="text-sm text-pink hover:text-fg">View public page ↗</Link>
        </div>
        <Card className="p-5"><ProfileForm key={org.id} organiser={org} /></Card>
      </section>

      <section aria-labelledby="team-h" className="space-y-4">
        <h2 id="team-h" className="font-display text-lg font-semibold">Team</h2>
        <TeamPanel organiserId={org.id} members={team} isOwner={org.member_role === "owner"} currentUserId={user.id} />
      </section>

      <section aria-labelledby="pay-h" className="space-y-3">
        <h2 id="pay-h" className="font-display text-lg font-semibold">Payments</h2>
        <Card className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{org.stripe_charges_enabled ? "Payouts are set up. You can sell paid tickets." : "Connect a payout account to sell paid tickets."}</p>
          <ButtonLink href={`/organiser/settings/payments?org=${org.id}`} variant="secondary" size="sm">Open</ButtonLink>
        </Card>
      </section>
    </div>
  );
}
