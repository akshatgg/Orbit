import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventCard } from "@/components/events/EventCard";
import { VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Eyebrow, PageHeader } from "@/components/ui/PageHeader";
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
  const pending = others.some((o) => o.status === "pending");

  if (orgs.length === 0) return <NoOrganiser />;

  return (
    <div className="space-y-6 px-4">
      {params.applied && !pending && (
        <Banner tone="brand">
          <strong className="font-semibold text-fg">Application sent.</strong> Your organisation is under review.
          We&apos;ll email you when it&apos;s approved.
        </Banner>
      )}
      {params.joined && (
        <Banner tone="success">
          <strong className="font-semibold text-fg">You&apos;ve joined the team.</strong> You can now create and manage events.
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

      {others.map((o) => <ApplicationCard key={o.id} org={o} justApplied={!!params.applied} />)}

      {selected ? (
        <>
          {approved.length > 1 && <OrgSwitcher orgs={approved} selectedId={selected.id} />}
          <OrganiserOverview org={selected} />
        </>
      ) : (
        others.length > 0 && !pending && (
          <p className="text-center text-xs text-subtle">
            Events can be created once an organisation is approved.
          </p>
        )
      )}
    </div>
  );
}

function NoOrganiser() {
  return (
    <div className="px-4">
      <div className="glass relative overflow-hidden rounded-[24px] p-6 text-center">
        <Eyebrow className="relative">For organisers</Eyebrow>
        <h2 className="relative mt-3 text-2xl font-semibold tracking-tight">
          Put your events in front of the <span className="text-fg">right students</span>
        </h2>
        <p className="relative mx-auto mt-3 max-w-sm text-sm text-muted">
          Societies, university teams, employers and communities use ORBIT to sell tickets, take applications and
          check guests in at the door.
        </p>
        <ul className="relative mx-auto mt-5 grid max-w-sm gap-2 text-left text-sm">
          {["Free & paid tickets with QR check-in", "Application forms you approve", "Or link to your own sign-up page"].map((t) => (
            <li key={t} className="flex items-center gap-2 text-fg/90">
              <span className="text-accent" aria-hidden>✓</span> {t}
            </li>
          ))}
        </ul>
        <ButtonLink href="/organiser/apply" size="lg" className="relative mt-6">Become an organiser</ButtonLink>
      </div>
    </div>
  );
}

function ApplicationCard({ org, justApplied }: { org: MyOrganiser; justApplied?: boolean }) {
  if (org.status === "pending") return <ReviewCard org={org} justApplied={justApplied} />;
  const copy: Record<string, string> = {
    rejected: "Your application wasn't approved this time.",
    suspended: "This organiser is suspended, so its events are hidden. Contact the ORBIT team if you think this is a mistake.",
  };
  return (
    <Card className="flex gap-3.5">
      <OrganiserLogo src={org.logo_url} name={org.name} size={52} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate font-semibold tracking-tight">{org.name}</h2>
          <OrganiserStatusBadge status={org.status} />
        </div>
        <p className="mt-1.5 text-sm text-muted">{copy[org.status] ?? ""}</p>
        {org.review_note && (
          <p className="mt-2 rounded-xl border border-ink/10 bg-ink/[0.045] px-3 py-2 text-sm">
            <span className="text-muted">Note from ORBIT: </span>
            {org.review_note}
          </p>
        )}
        <Link href={`/organiser/settings?org=${org.id}`} className="mt-2.5 inline-block text-sm font-medium text-accent transition-colors hover:text-fg">
          Edit profile →
        </Link>
        {org.status === "rejected" && (
          <Link href="/organiser/apply" className="mt-2.5 ml-4 inline-block text-sm font-medium text-accent transition-colors hover:text-fg">
            Apply again →
          </Link>
        )}
      </div>
    </Card>
  );
}

/** Pending organisations: the only thing Studio shows until an admin approves. */
function ReviewCard({ org, justApplied }: { org: MyOrganiser; justApplied?: boolean }) {
  const steps = [
    { label: justApplied ? "Application sent" : "Application received", hint: "Your organisation details are with the ORBIT team.", state: "done" },
    { label: "In review", hint: "Usually takes a day or two. We\u2019ll email you as soon as it\u2019s done.", state: "now" },
    { label: "Approved", hint: "Create events, sell tickets and check guests in.", state: "next" },
  ] as const;
  return (
    <section className="glass mx-auto w-full max-w-xl rounded-[24px] p-5 sm:p-7 lg:mx-0" aria-labelledby={`review-${org.id}`}>
      <div className="flex items-center gap-3.5">
        <OrganiserLogo src={org.logo_url} name={org.name} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight">{org.name}</p>
          <div className="mt-1"><OrganiserStatusBadge status={org.status} /></div>
        </div>
      </div>

      <h2 id={`review-${org.id}`} className="mt-6 text-xl font-semibold tracking-tight">
        {justApplied ? "Thanks, your application is in" : "Your organisation is in review"}
      </h2>

      <ol className="mt-5" aria-label="Review progress">
        {steps.map((st, i) => (
          <li key={st.label} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < steps.length - 1 && (
              <span aria-hidden className={`absolute left-[11px] top-7 bottom-1 w-px ${st.state === "done" ? "bg-accent/60" : "bg-ink/10"}`} />
            )}
            <span
              aria-hidden
              className={`relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                st.state === "done"
                  ? "bg-accent text-white"
                  : st.state === "now"
                    ? "border-2 border-accent bg-accent/10"
                    : "border-2 border-ink/15"
              }`}
            >
              {st.state === "done" ? "\u2713" : st.state === "now" ? <span className="h-2 w-2 animate-pulse rounded-full bg-accent motion-reduce:animate-none" /> : null}
            </span>
            <div className="min-w-0">
              <p className={`text-sm font-semibold ${st.state === "next" ? "text-muted" : "text-fg"}`}>
                {st.label}
                {st.state === "now" && <span className="sr-only"> (current step)</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted">{st.hint}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-6 border-t border-ink/[0.07] pt-5">
        <p className="text-sm text-muted">While you wait, add a logo and description so students know who you are.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ButtonLink href={`/organiser/settings?org=${org.id}`} variant="secondary" size="sm">Edit organisation profile</ButtonLink>
          <ButtonLink href="/" variant="ghost" size="sm">Browse events</ButtonLink>
        </div>
      </div>
    </section>
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
            className={`flex shrink-0 items-center gap-2 rounded-full border border-transparent py-1 pl-1 pr-3.5 text-sm transition-colors duration-200 ${
              active ? "is-selected text-fg" : "glass text-muted hover:text-fg"
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
          <h2 className="flex items-center gap-1.5 truncate text-lg font-semibold tracking-tight">
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

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <ButtonLink href={`/organiser/events/new?org=${org.id}`} size="lg" className="col-span-2 whitespace-nowrap sm:flex-1">
          <span aria-hidden>＋</span> New event
        </ButtonLink>
        <ButtonLink href={`/organiser/settings?org=${org.id}`} variant="secondary" size="lg">Settings</ButtonLink>
        <ButtonLink href={`/organiser/settings/payments?org=${org.id}`} variant="secondary" size="lg">
          {org.stripe_charges_enabled ? "Payouts" : "Get paid"}
        </ButtonLink>
      </div>

      {events.length === 0 ? (
        <div className="rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-10 text-center">
          <p className="font-semibold tracking-tight">No events yet</p>
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
    <div className="glass rounded-[20px] px-3.5 py-3.5">
      <p className="text-[1.65rem] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-[11px] font-medium text-muted">{label}</p>
    </div>
  );
}

function EventGroup({ title, events, draft = false }: { title: string; events: EventWithCounts[]; draft?: boolean }) {
  if (events.length === 0) return null;
  return (
    <section aria-labelledby={`group-${title}`}>
      <h3 id={`group-${title}`} className="mb-3 flex items-center gap-2 px-1 text-xs font-medium text-muted">
        {title} <span className="rounded-full bg-ink/[0.07] px-2 py-0.5 text-[10px] tracking-normal text-muted">{events.length}</span>
      </h3>
      <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
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
                  {editable && <Link href={`/organiser/events/${e.id}/edit`} className="text-accent transition-colors hover:text-fg">Edit</Link>}
                  {!draft && <Link href={`/organiser/events/${e.id}`} className="text-accent transition-colors hover:text-fg">Manage</Link>}
                  {!draft && <Link href={`/events/${e.id}`} className="text-accent transition-colors hover:text-fg">View</Link>}
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
    brand: "border-accent/25 bg-accent/10 text-muted",
    success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    neutral: "border-ink/10 bg-ink/[0.045] text-muted",
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
