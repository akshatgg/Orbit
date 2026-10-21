import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { HomeFeed, parseHomeView } from "@/components/discovery/HomeFeed";
import { FeedSkeleton } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import { parseSearchFilters } from "@/lib/discovery/filters";
import { getRankedFeed, getViewer } from "@/lib/discovery/queries";

export const metadata: Metadata = { title: "For You" };

/** How far ahead the feed looks. */
const HORIZON_DAYS = 60;

export default function ForYouPage({ searchParams }: PageProps<"/">) {
  return (
    <>
      <h1 className="sr-only">For You</h1>
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
  const noInterests =
    !profile.career_interests?.length && !profile.personal_interests?.length && !profile.preferred_categories?.length;

  return (
    <HomeFeed
      viewer={viewer}
      ranked={ranked}
      view={parseHomeView(params.view)}
      place={{ country, city }}
      now={now}
      nudge={noInterests ? <InterestsCard /> : null}
    />
  );
}

/** For people with no interests yet (e.g. host-only sign-ups): a friendly nudge instead of a bare feed. */
function InterestsCard() {
  return (
    <Link
      href="/profile/preferences"
      className="glass group flex items-center gap-3.5 rounded-[22px] p-4 transition duration-200 hover:brightness-110 motion-reduce:transition-none"
    >
      <span aria-hidden className="bg-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-xl font-medium text-bg">+</span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold tracking-tight">Want a personal feed too?</span>
        <span className="block text-sm text-muted">Pick a few interests <span aria-hidden>→</span></span>
      </span>
    </Link>
  );
}
