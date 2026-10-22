import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getMyOrganisers, getProfile } from "@/lib/auth";
import { hasHostGoal, initialGoals, safeNextPath } from "@/lib/profile/flow";
import { draftFromProfile } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/Skeleton";
import { OnboardingWizard } from "@/components/profile/OnboardingWizard";
import type { CategoryOption } from "@/components/profile/ProfileSteps";

export const metadata: Metadata = { title: "Welcome", robots: { index: false, follow: false } };

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <div className="mx-auto min-h-dvh max-w-md md:flex md:max-w-2xl md:items-center md:px-6 md:py-10">
      <Suspense fallback={<WelcomeSkeleton />}>
        <Onboarding searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Onboarding({ searchParams }: { searchParams: PageProps<"/onboarding">["searchParams"] }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");
  const profile = await getProfile();
  if (!profile) redirect("/login");

  if (profile.onboarded_at) {
    // Already set up. Hosts go on to their organisation (or its application, if they haven't got one
    // yet: also where a host lands if this re-renders just after the wizard saved), everyone else
    // to their preferences.
    if (params.intent === "host" || hasHostGoal(profile.goals)) {
      redirect((await getMyOrganisers()).length ? "/organiser" : "/organiser/apply");
    }
    redirect("/profile/preferences");
  }

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("slug, name, group").order("sort_order");
  const draft = draftFromProfile(profile);

  return (
    <OnboardingWizard
      initial={{ ...draft, goals: initialGoals(params.intent, draft.goals) }}
      categories={(data ?? []) as CategoryOption[]}
      next={safeNextPath(params.next)}
      email={user.email ?? ""}
      university={profile.university ?? ""}
    />
  );
}

function WelcomeSkeleton() {
  return (
    <div className="space-y-4 px-5 pt-24" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-52" />
      <div className="space-y-2.5 pt-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[4.5rem] rounded-[20px]" />)}
      </div>
    </div>
  );
}
