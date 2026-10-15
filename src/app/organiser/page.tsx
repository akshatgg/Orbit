import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/events/EventCard";
import { VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { OrganiserLogo, OrganiserStatusBadge } from "@/components/organiser/OrganiserStatus";
import { getMyOrganisers, requireUser, type MyOrganiser } from "@/lib/auth";
import type { EventWithCounts } from "@/lib/events/queries";
import { groupOrganiserEvents, pickOrganiser, totalRegistrations } from "@/lib/organiser/dashboard";
import { getFollowerCount, listOrganiserEvents } from "@/lib/organiser/queries";
import { labelFor, ORGANISER_KINDS } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Organiser Studio" };

export default function OrganiserDashboardPage({ searchParams }: PageProps<"/organiser">) {
  return (
    <>
      <PageHeader title="Studio" subtitle="Create events, track registrations and grow your audience." />
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/organiser">["searchParams"] }) {
  await requireUser();
  const [orgs, params] = await Promise.all([getMyOrganisers(), searchParams]);
  const selected = pickOrganiser(orgs, params.org);
  const others = orgs.filter((o) => o.status !== "approved");
  const approved = orgs.filter((o) => o.status === "approved");

  if (orgs.length === 0) return <NoOrganiser />;

  return (
    <div className="space-y-6 px-4">
      {params.applied && (
        <Banner tone="brand">
          <strong className="font-semibold text-fg">Application sent.</strong> We&apos;ll review it soon — you&apos;ll see the
          status change here once you&apos;re approved.
        </Banner>
      )}
      {typeof params.published === "string" && (
        <Banner tone="success">
          <strong className="font-semibold text-fg">Your event is live.</strong>{" "}
          <Link href={`/events/${params.published}`} className="underline underline-offset-2">View it</Link> or share the link.
        </Banner>
      )}
      {typeof params.updated === "string" && (
        <Banner tone="success">
          <strong className="font-semibold text-fg">Changes saved.</strong>{" "}
          <Link href={`/events/${params.updated}`} className="underline underline-offset-2">View the event</Link>
        </Banner>
      )}
      {typeof params.cancelled === "string" && <Banner tone="neutral">Event cancelled. Guests have been told.</Banner>}
      {typeof params.deleted === "string" && <Banner tone="neutral">Draft deleted.</Banner>}

      {others.map((o) => <ApplicationCard key={o.id} org={o} />)}

      {selected ? (
        <>
          {approved.length > 1 && <OrgSwitcher orgs={approved} selectedId={selected.id} />}
          <OrganiserOverview org={selected} />
        </>
      ) : (
        others.length > 0 && (
          <p className="text-center text-sm text-muted">
            Once an organiser is approved you can create events here.{" "}
            <Link href="/organiser/apply" className="text-pink hover:text-fg">Apply for another</Link>
          </p>
        )
      )}
    </div>
  );
}

function NoOrganiser() {
  return (
    <div className="px-4">
      <div className="border-gradient glow relative overflow-hidden rounded-3xl p-6 text-center">
        <div className="bg-gradient absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full opacity-25 blur-3xl" aria-hidden />
        <p className="relative font-display text-xs font-semibold uppercase tracking-[0.3em] text-muted">For organisers</p>
        <h2 className="relative mt-3 font-display text-2xl font-semibold">
          Put your events in front of the <span className="text-gradient">right students</span>
        </h2>
        <p className="relative mx-auto mt-3 max-w-sm text-sm text-muted">
          Societies, university teams, employers and communities use ORBIT to sell tickets, take applications and
          check guests in at the door.
        </p>
        <ul className="relative mx-auto mt-5 grid max-w-sm gap-2 text-left text-sm">
          {["Free & paid tickets with QR check-in", "Application forms you approve", "Or link to your own sign-up page"].map((t) => (
            <li key={t} className="flex items-center gap-2 text-fg/90">
              <span className="text-gradient font-semibold" aria-hidden>✦</span> {t}
            </li>
          ))}
        </ul>
        <ButtonLink href="/organiser/apply" size="lg" className="relative mt-6 glow">Become an organiser</ButtonLink>
      </div>
    </div>
  );
}

function ApplicationCard({ org }: { org: MyOrganiser }) {
  const copy: Record<string, string> = {
    pending: "Thanks for applying! The ORBIT team reviews new organisers once — usually within a day or two. You can create events as soon as you're approved.",
    rejected: "Your application wasn't approved this time.",
    suspended: "This organiser is suspended, so its events are hidden. Contact the ORBIT team if you think this is a mistake.",
  };
  return (
    <Card className="flex gap-3.5">
      <OrganiserLogo src={org.logo_url} name={org.name} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-display font-semibold">{org.name}</h2>
          <OrganiserStatusBadge status={org.status} />
        </div>
        <p className="mt-1.5 text-sm text-muted">{copy[org.status] ?? ""}</p>
        {org.review_note && (
          <p className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">Note from ORBIT: </span>
            {org.review_note}
          </p>
        )}
        <Link href={`/organiser/settings?org=${org.id}`} className="mt-2.5 inline-block text-sm font-medium text-pink hover:text-fg">
          {org.status === "pending" ? "Polish your profile while you wait →" : "Edit profile →"}
        </Link>
      </div>
    </Card>
  );
}

function OrgSwitcher({ orgs, selectedId }: { orgs: MyOrganiser[]; selectedId: string }) {
  return (
    <nav aria-label="Switch organiser" className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4">
      {orgs.map((o) => {
        const active = o.id === selectedId;
        return (
          <Link
            key={o.id}
            href={`/organiser?org=${o.id}`}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 rounded-full border py-1 pl-1 pr-3.5 text-sm transition-colors ${
              active ? "border-gradient text-fg" : "border-line bg-surface text-muted hover:text-fg"
            }`}
          >
            <OrganiserLogo src={o.logo_url} name={o.name} size={26} className="rounded-full" />
            {o.name}
          </Link>
        );
      })}
    </nav>
  );
}

async function OrganiserOverview({ org }: { org: MyOrganiser }) {
  const [events, followers] = await Promise.all([listOrganiserEvents(org.id), getFollowerCount(org.id)]);
  const groups = groupOrganiserEvents(events);
  const live = [...groups.upcoming, ...groups.past];

  return (
    <>
      <section className="flex items-center gap-3.5">
        <OrganiserLogo src={org.logo_url} name={org.name} size={56} />
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 truncate font-display text-lg font-semibold">
            {org.name} {org.is_verified && <VerifiedMark />}
          </h2>
          <p className="text-xs text-muted">
            {labelFor(ORGANISER_KINDS, org.kind)} ·{" "}
            <Link href={`/o/${org.slug}`} className="hover:text-fg">Public page ↗</Link>
          </p>
        </div>
      </section>

      <section aria-label="Summary" className="grid grid-cols-3 gap-2">
        <Stat label="Upcoming" value={groups.upcoming.length} />
        <Stat label="Registrations" value={totalRegistrations(live.map((e) => e.counts))} />
        <Stat label="Followers" value={followers} />
      </section>

      <div className="flex flex-wrap gap-2">
        <ButtonLink href={`/organiser/events/new?org=${org.id}`} size="lg" className="glow flex-1 sm:flex-none">
          <span aria-hidden>＋</span> New event
        </ButtonLink>
        <ButtonLink href={`/organiser/settings?org=${org.id}`} variant="secondary" size="lg">Settings</ButtonLink>
        <ButtonLink href={`/organiser/settings/payments?org=${org.id}`} variant="secondary" size="lg">
          {org.stripe_charges_enabled ? "Payouts" : "Get paid"}
        </ButtonLink>
      </div>

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
          <p className="font-display font-semibold">No events yet</p>
          <p className="mt-1.5 text-sm text-muted">Create your first event — save it as a draft and publish when you&apos;re ready.</p>
        </div>
      ) : (
        <div className="space-y-7">
          <EventGroup title="Drafts" events={groups.drafts} draft />
          <EventGroup title="Upcoming" events={groups.upcoming} />
          <EventGroup title="Past" events={groups.past} />
          <EventGroup title="Cancelled" events={groups.cancelled} />
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3 py-3">
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function EventGroup({ title, events, draft = false }: { title: string; events: EventWithCounts[]; draft?: boolean }) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby={`group-${title}`}>
      <h3 id={`group-${title}`} className="mb-2.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        {title} <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] tracking-normal">{events.length}</span>
      </h3>
      <div className="space-y-3">
        {events.map((e) => {
          const editable = e.status === "draft" || e.status === "published";
          return (
            <EventCard
              key={e.id}
              event={e}
              counts={e.counts}
              href={draft ? `/organiser/events/${e.id}/edit` : `/organiser/events/${e.id}`}
              actions={
                <span className="flex shrink-0 items-center gap-3 font-medium">
                  {!draft && (
                    <span className="text-muted">
                      {e.counts.going} going{e.counts.pending ? ` · ${e.counts.pending} pending` : ""}
                    </span>
                  )}
                  {editable && <Link href={`/organiser/events/${e.id}/edit`} className="text-pink hover:text-fg">Edit</Link>}
                  {!draft && <Link href={`/organiser/events/${e.id}`} className="text-pink hover:text-fg">Manage</Link>}
                  {!draft && <Link href={`/events/${e.id}`} className="text-pink hover:text-fg">View</Link>}
                </span>
              }
            />
          );
        })}
      </div>
    </section>
  );
}

function Banner({ tone, children }: { tone: "brand" | "success" | "neutral"; children: React.ReactNode }) {
  const tones = {
    brand: "border-violet/40 bg-violet/10 text-muted",
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    neutral: "border-line bg-surface text-muted",
  };
  return <p role="status" className={`rounded-2xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</p>;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 px-4" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3.5">
        <Skeleton className="h-14 w-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
      <Skeleton className="h-12" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
    </div>
  );
}
