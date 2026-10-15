import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth";
import { draftFromProfile } from "@/lib/profile/schema";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/nav/BackLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { PreferencesForm } from "@/components/profile/PreferencesForm";
import type { CategoryOption } from "@/components/profile/ProfileSteps";

export const metadata: Metadata = { title: "Preferences" };

export default function PreferencesPage() {
  return (
    <>
      <PageHeader
        title="Preferences"
        subtitle="Change these any time — your For You feed re-ranks straight away."
        back={<BackLink href="/profile" label="Profile" />}
      />
      <Suspense fallback={<PreferencesSkeleton />}>
        <Preferences />
      </Suspense>
    </>
  );
}

async function Preferences() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("slug, name, group").order("sort_order");
  return <PreferencesForm initial={draftFromProfile(profile)} categories={(data ?? []) as CategoryOption[]} />;
}

function PreferencesSkeleton() {
  return (
    <div className="space-y-4 px-4" aria-busy="true" aria-label="Loading preferences">
      {[64, 52, 60, 40].map((h) => (
        <div key={h} className="space-y-3 rounded-2xl border border-line p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className={h > 50 ? "h-8 w-1/2" : "hidden"} />
        </div>
      ))}
    </div>
  );
}
