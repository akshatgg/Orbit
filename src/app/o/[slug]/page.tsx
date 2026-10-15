import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventCard } from "@/components/events/EventCard";
import { FollowButton } from "@/components/organiser/FollowButton";
import { OrganiserLogo } from "@/components/organiser/OrganiserStatus";
import { VerifiedMark } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getMyEventState } from "@/lib/events/queries";
import { groupOrganiserEvents } from "@/lib/organiser/dashboard";
import { getFollowerCount, getOrganiserBySlug, isFollowing, listPublicOrganiserEvents } from "@/lib/organiser/queries";
import { labelFor, ORGANISER_KINDS } from "@/lib/taxonomy";

export async function generateMetadata({ params }: PageProps<"/o/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrganiserBySlug(slug);
  if (!org || org.status !== "approved") return { title: "Organiser not found" };
  const description = org.bio?.slice(0, 160) || `Events from ${org.name} on ORBIT.`;
  return {
    title: org.name,
    description,
    openGraph: { title: `${org.name} on ORBIT`, description, images: org.logo_url ? [org.logo_url] : undefined },
  };
}

export default function OrganiserPublicPage({ params }: PageProps<"/o/[slug]">) {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl pb-16">
      <Suspense fallback={<PageSkeleton />}>
        <Content params={params} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/o/[slug]">["params"] }) {
  const { slug } = await params;
  const org = await getOrganiserBySlug(slug);
  if (!org || org.status !== "approved") notFound();

  const user = await getCurrentUser();
  const [events, followers, following] = await Promise.all([
    listPublicOrganiserEvents(org.id),
    getFollowerCount(org.id),
    isFollowing(user?.id, org.id),
  ]);
  const state = await getMyEventState(user?.id, events.map((e) => e.id));
  const { upcoming, past } = groupOrganiserEvents(events);
  const site = org.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <header className="px-4 pb-6 pt-[max(env(safe-area-inset-top),2rem)]">
        <div className="flex items-start gap-4">
          <OrganiserLogo src={org.logo_url} name={org.name} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 font-display text-2xl font-semibold leading-tight">
              <span className="min-w-0 break-words">{org.name}</span> {org.is_verified && <VerifiedMark />}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {labelFor(ORGANISER_KINDS, org.kind)}
              {org.university ? ` · ${org.university}` : ""}
            </p>
            {site && org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-pink hover:text-fg">{site} ↗</a>
            )}
          </div>
        </div>
        {org.bio && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-fg/90">{org.bio}</p>}
        <div className="mt-5">
          <FollowButton organiserId={org.id} slug={org.slug} signedIn={Boolean(user)} following={following} count={followers} />
        </div>
      </header>

      <div className="space-y-8 px-4">
        <EventList title="Upcoming events" empty="No upcoming events right now. Follow to hear when something is announced." events={upcoming} state={state} />
        {past.length > 0 && <EventList title="Past events" events={past} state={state} />}
      </div>
    </>
  );
}

function EventList({ title, events, empty, state }: {
  title: string; events: Awaited<ReturnType<typeof listPublicOrganiserEvents>>; empty?: string; state: Awaited<ReturnType<typeof getMyEventState>>;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted">{title}</h2>
      {events.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{empty}</p>
      ) : (
        <div className="space-y-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} counts={e.counts} saved={state.saved.has(e.id)} registration={state.registrations.get(e.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 px-4 pt-8" aria-busy="true" aria-label="Loading">
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20 rounded-2xl" />
        <div className="flex-1 space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-32" /></div>
      </div>
      <Skeleton className="h-16" />
      {[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}
    </div>
  );
}
