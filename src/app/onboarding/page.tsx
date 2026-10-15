import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, getProfile } from "@/lib/auth";
import { draftFromProfile } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";
import { Skeleton } from "@/components/ui/Skeleton";
import { OnboardingWizard } from "@/components/profile/OnboardingWizard";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import type { CategoryOption } from "@/components/profile/ProfileSteps";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <Suspense fallback={<WelcomeSkeleton />}>
        <Onboarding />
      </Suspense>
    </div>
  );
}

async function Onboarding() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/onboarding");
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.onboarded_at) redirect("/profile/preferences");

  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("slug, name, group").order("sort_order");

  return <OnboardingWizard initial={draftFromProfile(profile)} categories={(data ?? []) as CategoryOption[]} />;
}

function WelcomeSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col items-center px-6 pb-6 pt-8" aria-busy="true" aria-label="Loading">
      <div className="flex flex-1 flex-col items-center justify-center">
        <OrbitEmblem size={124} />
        <Skeleton className="mt-6 h-8 w-56" />
        <Skeleton className="mt-3 h-8 w-64" />
        <Skeleton className="mt-5 h-10 w-72" />
      </div>
      <Skeleton className="h-12 w-full max-w-xs" />
    </div>
  );
}
