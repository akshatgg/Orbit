import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeedTabs } from "@/components/nav/FeedTabs";
import { HeroCard } from "@/components/discovery/Cards";
import { DesktopHome, parseHomeView } from "@/components/discovery/DesktopHome";
import { EventRows } from "@/components/events/EventRow";
import { DismissProvider, Dismissible } from "@/components/discovery/Dismiss";
import { DiscoveryHeader, FeedSkeleton, ICONS, IconLink, SectionHeading } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import { parseSearchFilters } from "@/lib/discovery/filters";
import { getRankedFeed, getViewer, type RankedEvent, type Viewer } from "@/lib/discovery/queries";
import type { Profile } from "@/types/database";
import { spotsLeft } from "@/lib/events/queries";

export const metadata: Metadata = { title: "For You" };

/** How far ahead the feed looks. */
const HORIZON_DAYS = 60;

export default function ForYouPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      {/* Phones: the For You heading and its tabs. Tablets and laptops get the DesktopHome layout. */}
      <div className="md:hidden">
        <DiscoveryHeader
          brand
          mobileAction={false}
          title="For You"
          subtitle="Ranked for your goals, interests and week"
          action={<IconLink href="/search" label="Explore all events" path={ICONS.search} />}
        />
        <FeedTabs />
      </div>
      <h1 className="sr-only max-md:hidden">For You</h1>
      <Suspense fallback={<FeedSkeleton />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Feed({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const profile = await requireProfile();
  const viewer = await getViewer(profile);
  const now = new Date();
  const ranked = await getRankedFeed(viewer, { days: HORIZON_DAYS, now });
  const params = await searchParams;
  const { country, city } = parseSearchFilters(params);

  return (
    <>
      <div className="md:hidden">
        <PhoneFeed profile={profile} viewer={viewer} ranked={ranked} now={now} />
      </div>
      <div className="hidden md:block">
        <DesktopHome viewer={viewer} ranked={ranked} view={parseHomeView(params.view)} place={{ country, city }} now={now} />
      </div>
    </>
  );
}

/** The phone feed: the top recommendation, then the rest by day. */
function PhoneFeed({ profile, viewer, ranked, now }: {
  profile: Profile; viewer: Viewer; ranked: RankedEvent[]; now: Date;
}) {
  const noInterests =
    !profile.career_interests?.length && !profile.personal_interests?.length && !profile.preferred_categories?.length;

  if (ranked.length === 0) {
    return (
      <>
      {noInterests && <InterestsCard />}
      <EmptyState
        title="You’re all caught up"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/search">Explore events</ButtonLink>
            <ButtonLink href="/profile" variant="secondary">Edit interests</ButtonLink>
          </div>
        }
      >
        Nothing new in the next {HORIZON_DAYS} days that you haven’t already booked or hidden. Explore everything,
        or add a few interests so we can find more for you.
      </EmptyState>
      </>
    );
  }

  // The hero should be something you can still get into: skip full events when anything else is open.
  const openIndex = ranked.findIndex((r) => spotsLeft(r.event, r.event.counts) !== 0);
  const topIndex = openIndex === -1 ? 0 : openIndex;
  const top = ranked[topIndex];
  const rest = ranked.filter((_, i) => i !== topIndex);
  const byDate = [...rest].sort((a, b) => Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at));
  const state = viewer.state;

  return (
    <DismissProvider>
      {noInterests && <InterestsCard />}

      <Dismissible id={top.event.id}>
        <section aria-label="Top recommendation" className="mx-4 mb-8">
          <HeroCard
            event={top.event}
            counts={top.event.counts}
            saved={state.saved.has(top.event.id)}
            reason={top.reason}
            dismissible
          />
        </section>
      </Dismissible>

      {rest.length > 0 && (
        <section aria-labelledby="more-for-you">
          <SectionHeading id="more-for-you" title="More for you" />
          {/* A chronological list under day headings. */}
          <EventRows
            items={byDate.map((r) => ({ event: r.event, registration: state.registrations.get(r.event.id) }))}
            groupBy="day"
            now={now}
            dismissible
            className="px-4"
          />
        </section>
      )}

      <div className="mx-4 mt-8 flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-6 text-center">
        <p className="text-sm text-muted">Looking for something specific?</p>
        <ButtonLink href="/search" variant="secondary" size="sm">Search every event</ButtonLink>
      </div>
    </DismissProvider>
  );
}

/** For people with no interests yet (e.g. host-only sign-ups): a friendly nudge instead of a bare feed. */
function InterestsCard() {
  return (
    <Link
      href="/profile/preferences"
      className="glass group mx-4 mb-5 flex items-center gap-3.5 rounded-[22px] p-4 transition duration-200 hover:brightness-110 motion-reduce:transition-none"
    >
      <span aria-hidden className="bg-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-xl font-medium text-bg">+</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold tracking-tight">Want a personal feed too?</span>
        <span className="block text-sm text-muted">Pick a few interests <span aria-hidden>→</span></span>
      </span>
    </Link>
  );
}
