import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventCard } from "@/components/events/EventCard";
import { EventRows } from "@/components/events/EventRow";
import { FollowButton } from "@/components/organiser/FollowButton";
import { OrganiserLogo } from "@/components/organiser/OrganiserStatus";
import { VerifiedMark } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCurrentUser } from "@/lib/auth";
import { getMyEventState } from "@/lib/events/queries";
import { groupOrganiserEvents } from "@/lib/organiser/dashboard";
import { getOrganiserBySlug, getOrganiserPage, listPublicOrganiserEvents } from "@/lib/organiser/queries";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildOrganisationJsonLd } from "@/lib/seo/jsonld";
import { absoluteUrl } from "@/lib/seo/site";
import { labelFor, ORGANISER_KINDS } from "@/lib/taxonomy";

export async function generateMetadata({ params }: PageProps<"/o/[slug]">): Promise<Metadata> {
  await connection(); // data reads below are per request
  const { slug } = await params;
  const org = await getOrganiserBySlug(slug);
  if (!org || org.status !== "approved") return { title: "Organiser not found" };
  const description = org.bio?.replace(/\s+/g, " ").trim().slice(0, 160) || `Career, networking and social events from ${org.name} on ORBIT.`;
  return {
    title: org.name,
    description,
    alternates: { canonical: absoluteUrl(`/o/${org.slug}`) },
    openGraph: {
      type: "profile",
      siteName: "ORBIT",
      title: `${org.name} on ORBIT`,
      description,
      url: absoluteUrl(`/o/${org.slug}`),
      images: [org.logo_url ?? "/opengraph-image"],
    },
    twitter: { card: org.logo_url ? "summary" : "summary_large_image", images: [org.logo_url ?? "/twitter-image"], title: `${org.name} on ORBIT`, description },
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
  const page = await getOrganiserPage(slug);
  if (!page || page.organiser.status !== "approved") notFound();
  const { organiser: org, follower_count: followers, following } = page;

  const [user, events] = await Promise.all([getCurrentUser(), listPublicOrganiserEvents(org)]);
  const state = await getMyEventState(user?.id, events.map((e) => e.id));
  const { upcoming, past } = groupOrganiserEvents(events);
  const site = org.website?.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return (
    <>
      <JsonLd data={buildOrganisationJsonLd(org)} />
      <header className="px-4 pb-6 pt-[max(env(safe-area-inset-top),1.5rem)]">
       <div className="glass rounded-[26px] p-5">
        <div className="flex items-start gap-4">
          <OrganiserLogo src={org.logo_url} name={org.name} size={80} />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold leading-tight tracking-tight">
              <span className="min-w-0 break-words">{org.name}</span> {org.is_verified && <VerifiedMark />}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {labelFor(ORGANISER_KINDS, org.kind)}
              {org.university ? ` · ${org.university}` : ""}
            </p>
            {site && org.website && (
              <a href={org.website} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-sm text-accent hover:text-fg">{site} ↗</a>
            )}
          </div>
        </div>
        {org.bio && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-fg/90">{org.bio}</p>}
        <div className="mt-5">
          <FollowButton organiserId={org.id} slug={org.slug} signedIn={Boolean(user)} following={following} count={followers} />
        </div>
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
      <h2 className="mb-3 font-display text-xs font-medium text-muted">{title}</h2>
      {events.length === 0 ? (
        <p className="rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-4 py-8 text-center text-sm text-muted">{empty}</p>
      ) : (
        <>
          <EventRows
            items={events.map((e) => ({ event: e, registration: state.registrations.get(e.id) }))}
            className="md:hidden"
          />
          <div className="hidden space-y-3 md:block">
            {events.map((e) => (
              <EventCard key={e.id} event={e} counts={e.counts} saved={state.saved.has(e.id)} registration={state.registrations.get(e.id)} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 px-4 pt-8" aria-busy="true" aria-label="Loading">
      <div className="flex gap-4">
        <Skeleton className="h-20 w-20 rounded-[20px]" />
        <div className="flex-1 space-y-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-32" /></div>
      </div>
      <Skeleton className="h-16 rounded-[22px]" />
      {[0, 1].map((i) => <Skeleton key={i} className="h-28 rounded-[22px]" />)}
    </div>
  );
}
