import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeedTabs } from "@/components/nav/FeedTabs";
import { RankedCard, TopPickCard } from "@/components/discovery/Cards";
import { DismissProvider, Dismissible } from "@/components/discovery/Dismiss";
import { DiscoveryHeader, FeedSkeleton, ICONS, IconLink, SectionHeading } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import { getRankedFeed, getViewer } from "@/lib/discovery/queries";

export const metadata: Metadata = { title: "For You" };

/** How far ahead the feed looks. */
const HORIZON_DAYS = 60;

export default function ForYouPage() {
  return (
    <>
      <DiscoveryHeader
        title="For You"
        subtitle="Ranked for your goals, interests and week"
        action={<IconLink href="/search" label="Explore all events" path={ICONS.search} />}
      />
      <FeedTabs />
      <Suspense fallback={<FeedSkeleton />}>
        <Feed />
      </Suspense>
    </>
  );
}

async function Feed() {
  const profile = await requireProfile();
  const viewer = await getViewer(profile);
  const now = new Date();
  const ranked = await getRankedFeed(viewer, { days: HORIZON_DAYS, now });

  const noInterests =
    !profile.career_interests?.length && !profile.personal_interests?.length && !profile.preferred_categories?.length;

  if (ranked.length === 0) {
    return (
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
    );
  }

  const [top, ...rest] = ranked;
  const state = viewer.state;

  return (
    <DismissProvider>
      {noInterests && (
        <p className="mx-4 mb-4 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-muted">
          Tell us what you’re into and this feed gets sharper.{" "}
          <Link href="/profile" className="font-semibold text-gradient">Add interests</Link>
        </p>
      )}

      <Dismissible id={top.event.id}>
        <section aria-label="Top pick" className="mx-4 mb-8">
          <TopPickCard
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
          <SectionHeading
            id="more-for-you"
            eyebrow="Next 60 days"
            title="More for you"
            count={rest.length}
          />
          <ul className="space-y-3 px-4">
            {rest.map((r) => (
              <Dismissible key={r.event.id} id={r.event.id}>
                <li>
                  <RankedCard
                    event={r.event}
                    counts={r.event.counts}
                    saved={state.saved.has(r.event.id)}
                    reason={r.reason}
                    dismissible
                  />
                </li>
              </Dismissible>
            ))}
          </ul>
        </section>
      )}

      <div className="mx-4 mt-8 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-6 text-center">
        <p className="text-sm text-muted">Looking for something specific?</p>
        <ButtonLink href="/search" variant="secondary" size="sm">Search every event</ButtonLink>
      </div>
    </DismissProvider>
  );
}
