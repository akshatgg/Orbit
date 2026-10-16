import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getInteractionCounts, getManagedEvent, listGuests } from "@/lib/guests/queries";
import { buildEventStats } from "@/lib/guests/stats";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { CopyLinkButton } from "@/components/guests/CopyLinkButton";
import { EventHeader, EventHeaderSkeleton, EventNav } from "@/components/guests/EventHeader";
import { CapacityBar, OverviewSkeleton, RegistrationsChart, StatTiles, StatusBreakdown } from "@/components/guests/Stats";

export const metadata: Metadata = { title: "Event overview" };

export default function Page({ params }: PageProps<"/organiser/events/[id]">) {
  return (
    <main className="space-y-5 pb-10">
      <Suspense fallback={<><EventHeaderSkeleton /><OverviewSkeleton /></>}>
        <Overview params={params} />
      </Suspense>
    </main>
  );
}

async function Overview({ params }: { params: PageProps<"/organiser/events/[id]">["params"] }) {
  await requireUser();
  const { id } = await params;
  const event = await getManagedEvent(id);
  if (!event) notFound();

  const [guests, interactions] = await Promise.all([listGuests(id), getInteractionCounts(id)]);
  const stats = buildEventStats(guests, { ...interactions, capacity: event.capacity, mode: event.registration_mode });
  const pending = stats.counts.pending;
  const base = `/organiser/events/${id}`;

  return (
    <>
      <EventHeader event={event} />
      <EventNav eventId={id} active="overview" pending={pending} />

      {pending > 0 && (
        <section className="border-gradient mx-4 flex items-center justify-between gap-3 rounded-[22px] p-4" aria-live="polite">
          <div className="min-w-0">
            <p className="font-semibold tracking-tight">
              {pending} {pending === 1 ? "application is" : "applications are"} waiting
            </p>
            <p className="text-sm text-muted">Approve or decline so people know where they stand.</p>
          </div>
          <ButtonLink href={`${base}/guests?status=pending`} size="sm" className="shrink-0">Review</ButtonLink>
        </section>
      )}

      <section aria-label="Quick actions" className="space-y-3 px-4">
        <Link
          href={`${base}/check-in`}
          className="bg-gradient group flex items-center justify-between gap-3 rounded-[22px] px-5 py-4 text-bg transition duration-200 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <span className="flex items-center gap-3">
            <ScanIcon />
            <span>
              <span className="block text-lg font-semibold tracking-tight">Check guests in</span>
              <span className="block text-sm font-medium text-bg/70">Scan tickets at the door</span>
            </span>
          </span>
          <span aria-hidden className="text-2xl transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">→</span>
        </Link>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <ButtonLink href={`${base}/guests`} variant="secondary">Guest list</ButtonLink>
          <ButtonLink href={`${base}/edit`} variant="secondary">Edit event</ButtonLink>
          <Link href={`/events/${id}`} className={buttonClass({ variant: "secondary" })}>View public page</Link>
          <CopyLinkButton path={`/events/${id}`} title={event.title} />
        </div>
      </section>

      {event.registration_mode !== "tickets" && (
        <p className="mx-4 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-muted">
          {event.registration_mode === "external"
            ? "People register on your own site, so ORBIT counts Apply-now clicks instead of tickets."
            : "This event is information only — there are no ORBIT tickets to track."}
        </p>
      )}

      <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-6 lg:space-y-0">
        <div className="space-y-5 lg:space-y-5">
          <StatTiles stats={stats} mode={event.registration_mode} />
          {stats.capacity && <CapacityBar capacity={stats.capacity} />}
        </div>
        <div className="space-y-5">
          <RegistrationsChart days={stats.byDay} />
          <StatusBreakdown stats={stats} eventId={id} />
        </div>
      </div>
    </>
  );
}

function ScanIcon() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-bg/10" aria-hidden>
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10" />
      </svg>
    </span>
  );
}
