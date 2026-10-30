import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { JoinOrbitChoice } from "@/components/profile/JoinOrbitChoice";
import { Skeleton } from "@/components/ui/Skeleton";
import { requireProfile } from "@/lib/auth";
import { safeNextPath } from "@/lib/profile/flow";
import { listChannels, listCommunities } from "@/lib/social/queries";

export const metadata: Metadata = { title: "Join the community", robots: { index: false, follow: false } };

export default function JoinCommunityPage({ searchParams }: PageProps<"/onboarding/community">) {
  return (
    <div className="mx-auto min-h-dvh max-w-md md:flex md:max-w-2xl md:items-center md:px-6 md:py-10">
      <Suspense fallback={<ChoiceSkeleton />}>
        <JoinCommunity searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

/** The last screen of onboarding: join ORBIT's community (the one everyone is offered), or skip it. */
async function JoinCommunity({ searchParams }: { searchParams: PageProps<"/onboarding/community">["searchParams"] }) {
  const [params] = await Promise.all([searchParams, requireProfile()]);
  const next = safeNextPath(params.next) ?? "/";
  const { items } = await listCommunities({}, { limit: 50 });
  const community = items.find((c) => c.auto_join);
  // Nothing to offer, or already in: carry on.
  if (!community || community.my_role) redirect(next);

  // Busiest first, so the list shows where the events are.
  const channels = (await listChannels(community.slug ?? community.id, {}, { limit: 50 })).items
    .filter((c) => !c.is_announcements)
    .sort((a, b) => (b.upcoming_event_count ?? 0) - (a.upcoming_event_count ?? 0));
  const upcoming = channels.reduce((n, c) => n + (c.upcoming_event_count ?? 0), 0);
  // Joining lands on the community, unless onboarding was on its way somewhere in particular.
  const joined = next === "/" ? `/communities/${community.slug ?? community.id}` : next;

  return <JoinOrbitChoice community={community} channels={channels} upcoming={upcoming} joined={joined} skipped={next} />;
}

function ChoiceSkeleton() {
  return (
    <div className="space-y-4 px-5 pt-24" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-52" />
      <Skeleton className="mt-4 h-64 rounded-[22px]" />
    </div>
  );
}
