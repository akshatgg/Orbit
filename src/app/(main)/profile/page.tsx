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
            className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-fg"
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
              <div className="px-4"><Skeleton className="h-44" /></div>
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
          <Suspense fallback={<div className="px-4"><Skeleton className="h-20" /></div>}>
            <OrganiserAndAdmin />
          </Suspense>
          <form action="/auth/signout" method="post" className="px-4 pt-2">
            <button
              type="submit"
              className="h-12 w-full rounded-2xl border border-line text-sm font-semibold text-muted transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300"
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
          className="group mx-4 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-violet/50"
        >
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-lg">⌘</span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Admin dashboard</span>
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
