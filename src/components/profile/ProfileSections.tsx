import Link from "next/link";
import type { ReactNode } from "react";
import type { Profile } from "@/types/database";
import type { MyOrganiser } from "@/lib/auth";
import { withCounts } from "@/lib/events/queries";
import type { ProfileEvent, FollowedOrganiser } from "@/lib/profile/queries";
import { normalizeAvailability, summariseAvailability } from "@/lib/profile/availability";
import { CAREER_INTERESTS, EVENT_FORMATS, ORGANISER_KINDS, PERSONAL_INTERESTS, labelFor } from "@/lib/taxonomy";
import { effectiveUserType } from "@/lib/profile/user-type";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { EventCard } from "@/components/events/EventCard";
import { ShareToGroupButton } from "@/components/social/ShareToGroupButton";
import { AttendedToggle, FollowToggle } from "./ProfileActions";

/** Section heading row used down the profile page. */
export function SectionHeading({ title, count, action }: { title: string; count?: number; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-4">
      <h2 className="text-lg font-semibold tracking-tight">
        {title}
        {count ? (
          <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-ink/[0.08] px-1.5 align-middle text-[11px] font-semibold text-muted">
            <span className="sr-only">(</span>
            {count}
            <span className="sr-only">)</span>
          </span>
        ) : null}
      </h2>
      {action}
    </div>
  );
}

const linkClass = "text-sm font-medium text-accent transition-colors hover:text-fg";

/** One line under the name that fits the person: course for students, job for professionals. */
export function profileLine(profile: Profile): string {
  switch (effectiveUserType(profile)) {
    case "student":
      return [profile.university, profile.course].filter(Boolean).join(" · ");
    case "graduate":
      return [profile.university, profile.graduation_year ? `Class of ${profile.graduation_year}` : null].filter(Boolean).join(" · ");
    case "professional":
      return [profile.job_title, profile.company].filter(Boolean).join(" at ") || profile.industry || "";
    default:
      return profile.host_role ?? "";
  }
}

export function ProfileHero({ profile }: { profile: Profile }) {
  const type = effectiveUserType(profile);
  const line = profileLine(profile);
  return (
    <section className="relative mx-4 overflow-hidden rounded-[26px] glass p-5">
      <div className="relative flex items-center gap-4">
        <span className="rounded-full bg-gradient-to-br from-pink/60 via-blue/40 to-orange/50 p-[1.5px]">
          <span className="block rounded-full bg-bg p-[2px]">
            <Avatar src={profile.avatar_url} name={profile.full_name ?? profile.email} size={68} />
          </span>
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{profile.full_name || "Your profile"}</h2>
          {profile.email && <p className="truncate text-sm text-muted">{profile.email}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.is_verified_student && (
              <Badge tone="info">
                <VerifiedMark className="h-3.5 w-3.5 text-[8px]" /> Verified student
              </Badge>
            )}
            {type === "student" && profile.year_of_study && <Badge>{profile.year_of_study}</Badge>}
            {profile.goals.includes("host") && <Badge tone="brand">Host</Badge>}
          </div>
        </div>
      </div>
      {line && <p className="relative mt-4 text-sm text-fg/90">{line}</p>}
      {type === "student" && profile.department && <p className="relative text-xs text-muted">{profile.department}</p>}
    </section>
  );
}

export function InterestsSummary({ profile, categoryNames }: { profile: Profile; categoryNames: Map<string, string> }) {
  const career = profile.career_interests.map((v) => labelFor(CAREER_INTERESTS, v));
  const personal = profile.personal_interests.map((v) => labelFor(PERSONAL_INTERESTS, v));
  const categories = profile.preferred_categories.map((s) => categoryNames.get(s) ?? s);
  const formats = profile.preferred_formats.map((v) => labelFor(EVENT_FORMATS, v));
  const availability = summariseAvailability(normalizeAvailability(profile.availability));
  const empty = !career.length && !personal.length && !categories.length;

  return (
    <section>
      <SectionHeading title="Your interests" action={<Link href="/profile/preferences" className={linkClass}>Edit</Link>} />
      <div className="glass mx-4 space-y-4 rounded-[22px] p-4">
        {empty ? (
          <p className="text-sm text-muted">
            No interests yet. <Link href="/profile/preferences" className={linkClass}>Add some</Link> to sharpen your feed.
          </p>
        ) : (
          <>
            <ChipRow label="Career" items={career} brand />
            <ChipRow label="Personal" items={personal} />
            <ChipRow label="Events" items={categories} />
          </>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-ink/[0.07] pt-3 text-sm">
          <dt className="text-subtle">Format</dt>
          <dd>{formats.length ? formats.join(", ") : "Any"}</dd>
          <dt className="text-subtle">Location</dt>
          <dd>{profile.location_preference || "Anywhere"}</dd>
          <dt className="text-subtle">Free</dt>
          <dd>{availability || "Not set"}</dd>
        </dl>
      </div>
    </section>
  );
}

function ChipRow({ label, items, brand }: { label: string; items: string[]; brand?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 font-display text-xs font-medium text-muted">{label}</p>
      <ul className="flex flex-wrap gap-1.5">
        {items.map((i) => (
          <li
            key={i}
            className={`rounded-full border px-2.5 py-1 text-xs ${brand ? "border-accent/25 bg-accent/10 text-accent" : "border-ink/10 bg-ink/[0.06] text-fg/90"}`}
          >
            {i}
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function SavedEventsList({ events }: { events: ProfileEvent[] }) {
  if (!events.length) {
    return (
      <EmptyState
        title="Nothing saved yet"
        action={<ButtonLink href="/" size="sm" variant="secondary">Find events</ButtonLink>}
      >
        Tap the bookmark on any event to keep it here.
      </EmptyState>
    );
  }
  const withC = await withCounts(events);
  return (
    <div className="space-y-3 px-4">
      {withC.map((e, i) => (
        <EventCard
          key={e.id}
          event={e}
          counts={e.counts}
          saved
          registration={events[i].registration}
          actions={e.status === "published" ? <ShareToGroupButton eventId={e.id} eventTitle={e.title} variant="text" /> : undefined}
        />
      ))}
    </div>
  );
}

export function PastEventsList({ events }: { events: ProfileEvent[] }) {
  if (!events.length) {
    return (
      <EmptyState title="No past events yet">
        Events you save or register for show up here once they&apos;re over.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3 px-4">
      {events.map((e) => (
        <div key={e.id} className="opacity-90 transition-opacity hover:opacity-100">
          <EventCard
            event={e}
            reason={null}
            actions={
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-muted">{e.attended ? "Glad you made it" : "Did you go?"}</span>
                <AttendedToggle eventId={e.id} attended={e.attended} />
              </span>
            }
          />
        </div>
      ))}
    </div>
  );
}

export function FollowingList({ organisers }: { organisers: FollowedOrganiser[] }) {
  if (!organisers.length) {
    return (
      <EmptyState title="Not following anyone yet">
        Follow societies, careers teams and employers to see their events first.
      </EmptyState>
    );
  }
  return (
    <ul className="glass mx-4 divide-y divide-ink/[0.07] overflow-hidden rounded-[22px]">
      {organisers.map((o) => (
        <li key={o.id} className="flex items-center gap-3 px-3 py-3">
          <Link href={`/o/${o.slug}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={o.logo_url} name={o.name} size={40} />
            <span className="min-w-0">
              <span className="flex items-center gap-1 truncate text-sm font-semibold">
                {o.name}
                {o.is_verified && <VerifiedMark className="h-3.5 w-3.5 text-[8px]" />}
              </span>
              <span className="block truncate text-xs text-muted">{labelFor(ORGANISER_KINDS, o.kind)}</span>
            </span>
          </Link>
          <FollowToggle organiserId={o.id} name={o.name} />
        </li>
      ))}
    </ul>
  );
}

const ORG_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  approved: { label: "Live", tone: "success" },
  pending: { label: "In review", tone: "warning" },
  rejected: { label: "Not approved", tone: "danger" },
  suspended: { label: "Suspended", tone: "danger" },
};

export function OrganiserCard({ organisers }: { organisers: MyOrganiser[] }) {
  if (!organisers.length) {
    return (
      <Link
        href="/organiser/apply"
        className="group glass mx-4 flex items-center gap-4 rounded-[22px] p-4 transition duration-200 hover:bg-ink/[0.08] motion-reduce:transition-none"
      >
        <span aria-hidden className="bg-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-xl font-medium text-bg">+</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tracking-tight">Host events on ORBIT</span>
          <span className="block text-sm text-muted">Run a society, careers team or company? Apply to post events.</span>
        </span>
        <Chevron />
      </Link>
    );
  }
  return (
    <Link
      href="/organiser"
      className="group mx-4 block rounded-[22px] glass p-4 transition duration-200 hover:brightness-110 motion-reduce:transition-none"
    >
      <span className="flex items-center gap-4">
        <span aria-hidden className="bg-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-lg font-semibold text-bg">S</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tracking-tight">Organiser Studio</span>
          <span className="block text-sm text-muted">Create events, manage guests and check people in.</span>
        </span>
        <Chevron />
      </span>
      <ul className="mt-3 space-y-2 border-t border-ink/[0.07] pt-3">
        {organisers.map((o) => {
          const s = ORG_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
          return (
            <li key={o.id} className="flex items-center gap-2.5 text-sm">
              <Avatar src={o.logo_url} name={o.name} size={24} />
              <span className="min-w-0 flex-1 truncate">{o.name}</span>
              <Badge tone={s.tone}>{s.label}</Badge>
            </li>
          );
        })}
      </ul>
    </Link>
  );
}

export function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ProfileHeroSkeleton() {
  return (
    <div className="glass mx-4 rounded-[26px] p-5" aria-busy="true" aria-label="Loading profile">
      <div className="flex items-center gap-4">
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Skeleton className="mt-4 h-4 w-56" />
    </div>
  );
}

export function SectionSkeleton({ rows = 2, height = "h-[7.5rem]" }: { rows?: number; height?: string }) {
  return (
    <div className="space-y-3 px-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}
