import { Suspense } from "react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { FeedTabs } from "@/components/nav/FeedTabs";
import { PickCard, RankedCard } from "@/components/discovery/Cards";
import { DismissProvider, Dismissible } from "@/components/discovery/Dismiss";
import { DiscoveryHeader, SectionHeading, WeekSkeleton } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import { dayKey } from "@/lib/format";
import { addDays, formatDayRange } from "@/lib/discovery/dates";
import { getRankedFeed, getViewer, type RankedEvent } from "@/lib/discovery/queries";

export const metadata: Metadata = { title: "This Week" };

const TOP_PICKS = 3;

const SECTIONS = [
  { group: "career", title: "Career & academic", eyebrow: "Grow" },
  { group: "social", title: "Social & community", eyebrow: "Meet people" },
  { group: "other", title: "Other interests", eyebrow: "Everything else" },
] as const;

export default function WeekPage() {
  return (
    <>
      <DiscoveryHeader title="This Week" subtitle="Your shortlist for the next 7 days" />
      <FeedTabs />
      <Suspense fallback={<WeekSkeleton />}>
        <Week />
      </Suspense>
    </>
  );
}

async function Week() {
  const profile = await requireProfile();
  const viewer = await getViewer(profile);
  const now = new Date();
  const ranked = await getRankedFeed(viewer, { days: 7, now });
  const today = dayKey(now);

  if (ranked.length === 0) {
    return (
      <EmptyState
        title="A quiet week"
        action={<ButtonLink href="/search?date=month">See the next 30 days</ButtonLink>}
      >
        Nothing new for you in the next 7 days. Look further ahead or browse everything in Explore.
      </EmptyState>
    );
  }

  // Top picks first; every other event lands in exactly one section (already sorted by score).
  const picks = ranked.slice(0, TOP_PICKS);
  const rest = ranked.slice(TOP_PICKS);
  const groupOf = (r: RankedEvent) => r.event.category?.group ?? "other";
  const saved = viewer.state.saved;

  return (
    <DismissProvider>
      <p className="-mt-1 mb-5 px-4 font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-subtle">
        {formatDayRange(today, addDays(today, 7))} · {ranked.length} event{ranked.length === 1 ? "" : "s"}
      </p>

      <section aria-labelledby="top-picks" className="mb-8">
        <SectionHeading id="top-picks" eyebrow="Best for you" title="Top picks" />
        <ul className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-1 md:grid md:grid-cols-3 md:gap-4 md:overflow-visible">
          {picks.map((r, i) => (
            <li key={r.event.id} className="flex md:[&>article]:w-full">
              <PickCard
                event={r.event}
                counts={r.event.counts}
                saved={saved.has(r.event.id)}
                reason={r.reason}
                rank={i + 1}
              />
            </li>
          ))}
        </ul>
      </section>

      {SECTIONS.map(({ group, title, eyebrow }) => {
        const items = rest.filter((r) => groupOf(r) === group);
        if (!items.length) return null;
        const id = `section-${group}`;
        return (
          <section key={group} aria-labelledby={id} className="mb-8">
            <SectionHeading id={id} eyebrow={eyebrow} title={title} count={items.length} />
            <ul className="space-y-3 px-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
              {items.map((r) => (
                <Dismissible key={r.event.id} id={r.event.id}>
                  <li>
                    <RankedCard
                      event={r.event}
                      counts={r.event.counts}
                      saved={saved.has(r.event.id)}
                      reason={r.reason}
                      dismissible
                      tile
                    />
                  </li>
                </Dismissible>
              ))}
            </ul>
          </section>
        );
      })}

      {rest.length === 0 && (
        <p className="px-4 text-center text-sm text-muted">That’s everything for this week — your top picks are above.</p>
      )}
    </DismissProvider>
  );
}
