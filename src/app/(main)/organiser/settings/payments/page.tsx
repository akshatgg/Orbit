import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { BackLink } from "@/components/nav/BackLink";
import { PayoutsPanel } from "@/components/payments/PayoutsPanel";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { authed } from "@/lib/api/session";
import { getMyOrganisers, requireProfile } from "@/lib/auth";
import { parseFeePercent, type ConnectState } from "@/lib/payments/logic";
import { openStripeDashboard, startPayoutSetup } from "./actions";

export const metadata: Metadata = { title: "Payments" };

type SearchParams = PageProps<"/organiser/settings/payments">["searchParams"];

export default function Page({ searchParams }: PageProps<"/organiser/settings/payments">) {
  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Get paid for tickets"
        back={<BackLink href="/organiser/settings" label="Settings" />}
      />
      <Suspense fallback={<ListSkeleton rows={2} />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** `GET /payments/connect/status`: read live from Stripe (and synced) when it can be reached. */
type ConnectStatus = {
  configured: boolean;
  state: ConnectState;
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean | null;
  details_submitted: boolean | null;
  due_count: number | null;
  live: boolean;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

async function Content({ searchParams }: { searchParams: SearchParams }) {
  await requireProfile();
  const params = await searchParams;
  const requested = first(params.org);
  const linkError = first(params.error) === "link";
  // Stripe sends an expired or reused onboarding link back with ?stripe=refresh: get a fresh one.
  if (first(params.stripe) === "refresh" && requested) {
    redirect(`/api/stripe/connect/refresh?org=${encodeURIComponent(requested)}`);
  }

  const memberships = await getMyOrganisers();
  const owned = memberships.filter((o) => o.member_role === "owner");

  if (memberships.length === 0) {
    return (
      <EmptyState
        title="You're not an organiser yet"
        action={<ButtonLink href="/organiser/apply">Become an organiser</ButtonLink>}
      >
        Apply to host events on ORBIT, then come back here to sell paid tickets.
      </EmptyState>
    );
  }

  if (owned.length === 0) {
    const names = memberships.map((o) => o.name).join(", ");
    return (
      <EmptyState title="Only owners can manage payouts">
        You&apos;re an editor for {names}. Ask the organiser&apos;s owner to connect a payout account.
      </EmptyState>
    );
  }

  const org = owned.find((o) => o.id === requested) ?? owned[0];
  const notOwner = requested && requested !== org.id ? memberships.find((o) => o.id === requested) : null;

  const status = await authed.get<ConnectStatus>("/payments/connect/status", { query: { organiser_id: org.id } });

  return (
    <div className="space-y-4 px-4">
      {owned.length > 1 && (
        <nav aria-label="Organiser" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
          {owned.map((o) => {
            const active = o.id === org.id;
            return (
              <Link
                key={o.id}
                href={`/organiser/settings/payments?org=${o.id}`}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  active ? "border-transparent bg-gradient font-medium text-bg" : "border-transparent glass text-muted hover:text-fg"
                }`}
              >
                {o.name}
              </Link>
            );
          })}
        </nav>
      )}

      {notOwner && (
        <p role="status" className="rounded-2xl border border-ink/10 bg-ink/[0.045] px-4 py-3 text-sm text-muted">
          Only the owner of {notOwner.name} can manage its payouts.
        </p>
      )}
      {linkError && (
        <p role="alert" className="rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-300">
          That Stripe link didn&apos;t work. Tap the button below to try again.
        </p>
      )}

      <PayoutsPanel
        state={status.state}
        org={{ id: org.id, name: org.name, status: org.status }}
        feePercent={parseFeePercent(process.env.PLATFORM_FEE_PERCENT)}
        payoutsEnabled={status.payouts_enabled ?? undefined}
        detailsSubmitted={status.details_submitted ?? undefined}
        dueCount={status.due_count ?? undefined}
        liveStatus={status.live || !status.connected}
        startSetup={startPayoutSetup}
        openDashboard={openStripeDashboard}
      />
    </div>
  );
}
