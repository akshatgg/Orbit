import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMyOrganisers, isAdmin, requireProfile } from "@/lib/auth";
import { getCategoryNames, getFollowedOrganisers, getMyEventLists } from "@/lib/profile/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import {
  Chevron,
  FollowingList,
  InterestsSummary,
  OrganiserCard,
  PastEventsList,
  ProfileHero,
  ProfileHeroSkeleton,
  SavedEventsList,
  SectionHeading,
  SectionSkeleton,
} from "@/components/profile/ProfileSections";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader
        title="Profile"
        action={
          <Link
            href="/profile/preferences"
            aria-label="Edit preferences"
            className="glass flex h-10 w-10 items-center justify-center rounded-full text-muted transition duration-200 hover:bg-white/[0.09] hover:text-fg active:scale-95 motion-reduce:transition-none"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
              <circle cx="16" cy="6" r="2" />
              <circle cx="10" cy="12" r="2" />
              <circle cx="18" cy="18" r="2" />
            </svg>
          </Link>
        }
      />

      <div className="space-y-9">
        <Suspense
          fallback={
            <div className="space-y-9">
              <ProfileHeroSkeleton />
              <div className="px-4"><Skeleton className="h-44 rounded-[22px]" /></div>
            </div>
          }
        >
          <HeroAndInterests />
        </Suspense>

        <section>
          <Suspense fallback={<><SectionHeading title="Saved events" /><SectionSkeleton /></>}>
            <SavedSection />
          </Suspense>
        </section>

        <section>
          <Suspense fallback={<><SectionHeading title="Following" /><SectionSkeleton rows={1} height="h-16" /></>}>
            <FollowingSection />
          </Suspense>
        </section>

        <section>
          <Suspense fallback={<><SectionHeading title="Past events" /><SectionSkeleton rows={1} /></>}>
            <PastSection />
          </Suspense>
        </section>

        <section>
          <SectionHeading title="Notifications" />
          <p className="-mt-2 mb-3 px-4 text-sm text-muted">Reminders before saved events start and deadlines close.</p>
          <Suspense fallback={<SectionSkeleton rows={1} height="h-16" />}>
            <NotificationSettings />
          </Suspense>
        </section>

        <section className="space-y-3">
          <SectionHeading title="More" />
          <Suspense fallback={<div className="px-4"><Skeleton className="h-20 rounded-[22px]" /></div>}>
            <OrganiserAndAdmin />
          </Suspense>
          <form action="/auth/signout" method="post" className="px-4 pt-2">
            <button
              type="submit"
              className="glass h-12 w-full rounded-full text-sm font-semibold text-muted transition duration-200 hover:border-red-400/30 hover:bg-red-500/10 hover:text-red-300 active:scale-[0.98] motion-reduce:transition-none"
            >
              Sign out
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

async function HeroAndInterests() {
  const profile = await requireProfile();
  const categoryNames = await getCategoryNames();
  return (
    <div className="space-y-9">
      <ProfileHero profile={profile} />
      <InterestsSummary profile={profile} categoryNames={categoryNames} />
    </div>
  );
}

async function SavedSection() {
  const profile = await requireProfile();
  const { saved } = await getMyEventLists(profile.id);
  return (
    <>
      <SectionHeading title="Saved events" count={saved.length} />
      <SavedEventsList events={saved} />
    </>
  );
}

async function FollowingSection() {
  const profile = await requireProfile();
  const organisers = await getFollowedOrganisers(profile.id);
  return (
    <>
      <SectionHeading title="Following" count={organisers.length} />
      <FollowingList organisers={organisers} />
    </>
  );
}

async function PastSection() {
  const profile = await requireProfile();
  const { past } = await getMyEventLists(profile.id);
  return (
    <>
      <SectionHeading title="Past events" count={past.length} />
      <PastEventsList events={past} />
    </>
  );
}

async function OrganiserAndAdmin() {
  const profile = await requireProfile();
  const organisers = await getMyOrganisers();
  return (
    <div className="space-y-3">
      <OrganiserCard organisers={organisers} />
      {isAdmin(profile) && (
        <Link
          href="/admin"
          className="group glass mx-4 flex items-center gap-4 rounded-[22px] p-4 transition duration-200 hover:bg-white/[0.08] motion-reduce:transition-none"
        >
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.06] text-lg">⌘</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold tracking-tight">Admin dashboard</span>
            <span className="block text-sm text-muted">
              {profile.role === "super_admin" ? "Super admin" : "Admin"} · organisers, events, users
            </span>
          </span>
          <Chevron />
        </Link>
      )}
    </div>
  );
}
