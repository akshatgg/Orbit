import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApproveRejectButtons } from "@/components/admin/OrganiserActions";
import { MarkReviewedButton } from "@/components/admin/EventActions";
import { AdminHeader, Empty, KpiTile, Panel, SectionLabel } from "@/components/admin/primitives";
import { SignupsChart } from "@/components/admin/SignupsChart";
import { Toaster } from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/auth";
import { AUDIT_ACTIONS } from "@/lib/admin/labels";
import { compactNumber, fillDailySeries, percent, toStats } from "@/lib/admin/kpi";
import { personName } from "@/lib/admin/queries";
import type { AuditEntry } from "@/lib/admin/types";
import { authed } from "@/lib/api/session";
import { formatEventDate } from "@/lib/format";

export const metadata: Metadata = { title: "Overview · Admin" };

export default function Page() {
  return (
    <>
      <AdminHeader eyebrow="Dashboard" title="Overview" subtitle="Everything happening on ORBIT, and what needs you." />
      <Suspense fallback={<OverviewSkeleton />}>
        <Content />
      </Suspense>
      <Toaster />
    </>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[7.5rem] rounded-[18px]" />)}
      </div>
      <Skeleton className="h-64 rounded-[20px]" />
    </div>
  );
}

const ukDay = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const whenFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

type Overview = {
  stats: Record<string, number> | null;
  signups_daily: { day: string; signups: number }[];
  organisers_pending: number;
  review_queue: number;
  approval_queue: { id: string; title: string; starts_at: string; pending: number }[];
  pending_organisers: { id: string; name: string; kind: string; university: string | null; created_at: string }[];
  audit: (AuditEntry & { actor_name: string | null })[];
};

type ReviewRow = { id: string; title: string; starts_at: string; source: string; source_name?: string; status: string };

async function Content() {
  await requireAdmin();

  const [overview, reviewPage] = await Promise.all([
    authed.get<Overview>("/admin/overview"),
    authed.get<{ items: ReviewRow[] }>("/admin/events", { query: { review: true, when: "upcoming", page_size: 20 } }),
  ]);

  const s = toStats(overview.stats);
  const series = fillDailySeries(
    overview.signups_daily.map((r) => ({ day: r.day, count: r.signups })),
    30,
    ukDay(),
  );

  const needsApproval = overview.approval_queue;
  const orgs = overview.pending_organisers.map((o) => ({ ...o, status: "pending" as const, is_verified: false }));
  const reviews = reviewPage.items.filter((e) => e.status !== "removed" && e.status !== "expired").slice(0, 6);
  const log = overview.audit;
  const attention = s.organisers_pending + s.needs_review + needsApproval.length;

  return (
    <div className="space-y-5">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="Users" value={compactNumber(s.users)} hint={`+${s.signups_7d} this week`} href="/admin/users" accent />
        <KpiTile label="Onboarded" value={`${percent(s.onboarded, s.users)}%`} hint={`${s.onboarded} of ${s.users} users`} />
        <KpiTile label="Verified students" value={compactNumber(s.verified_students)} hint={`${percent(s.verified_students, s.users)}% of users`} href="/admin/users" />
        <KpiTile
          label="Organisers"
          value={<>{s.organisers_approved}<span className="ml-1 text-base text-muted">approved</span></>}
          hint={s.organisers_pending ? `${s.organisers_pending} pending review` : "Nothing pending"}
          href="/admin/organisers"
          alert={s.organisers_pending > 0}
        />
        <KpiTile label="Registrations" value={compactNumber(s.registrations)} hint={`${s.registrations_7d} in the last 7 days`} />
        <KpiTile label="Upcoming events" value={compactNumber(s.upcoming_events)} hint="Different events, a series once" href="/admin/events" accent />
        <KpiTile label="Upcoming dates" value={compactNumber(s.upcoming_dates)} hint="Every date, not yet finished" href="/admin/events" />
        <KpiTile label="Events this week" value={s.events_this_week} hint="Starting in the next 7 days" href="/admin/events?when=upcoming" />
        <KpiTile label="Dates this week" value={s.dates_this_week} hint="Every date in the next 7 days" href="/admin/events?when=upcoming" />
        <KpiTile label="Check-ins" value={compactNumber(s.check_ins)} hint={`${percent(s.check_ins, s.registrations)}% of registrations`} />
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title={<>Needs attention {attention > 0 && <span className="bg-gradient ml-1.5 rounded-full px-1.5 py-px align-middle text-[11px] font-semibold text-bg tabular-nums">{attention}</span>}</>}
        >
          {attention === 0 ? (
            <div className="p-5"><Empty title="All clear">No applications, reviews or approvals waiting.</Empty></div>
          ) : (
            <div className="divide-y divide-line">
              {orgs.length > 0 && (
                <div className="p-5">
                  <SectionLabel action={<Link href="/admin/organisers" className="text-muted transition-colors hover:text-fg">See all {s.organisers_pending}</Link>}>
                    Organiser applications
                  </SectionLabel>
                  <ul className="space-y-3">
                    {orgs.map((o) => (
                      <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{o.name}</span>
                          <span className="block truncate text-xs text-muted">{o.university ?? o.kind} · applied {formatEventDate(o.created_at)}</span>
                        </span>
                        <ApproveRejectButtons org={o} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {reviews.length > 0 && (
                <div className="p-5">
                  <SectionLabel action={<Link href="/admin/events?review=1&when=all" className="text-muted transition-colors hover:text-fg">See all {s.needs_review}</Link>}>
                    Events to review
                  </SectionLabel>
                  <ul className="space-y-3">
                    {reviews.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0">
                          <Link href={`/events/${e.id}`} className="block truncate text-sm font-medium transition-colors hover:text-accent">{e.title}</Link>
                          <span className="block text-xs text-muted">{whenFmt.format(new Date(e.starts_at))} · {e.source_name ?? e.source}</span>
                        </span>
                        <MarkReviewedButton eventId={e.id} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {needsApproval.length > 0 && (
                <div className="p-5">
                  <SectionLabel>Starting soon with guests awaiting approval</SectionLabel>
                  <ul className="space-y-3">
                    {needsApproval.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="min-w-0">
                          <Link href={`/events/${e.id}`} className="block truncate font-medium transition-colors hover:text-accent">{e.title}</Link>
                          <span className="block text-xs text-muted">{whenFmt.format(new Date(e.starts_at))}</span>
                        </span>
                        <Badge tone="warning" className="shrink-0 tabular-nums">{e.pending} pending</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Panel>

        <Panel className="lg:col-span-2" title="Sign-ups, last 30 days">
          <SignupsChart series={series} />
        </Panel>
      </div>

      <Panel title="Recent admin activity">
        {log.length === 0 ? (
          <div className="p-5"><Empty title="No activity yet">Approvals, cancellations and role changes will be logged here.</Empty></div>
        ) : (
          <ul className="divide-y divide-line/60 text-sm">
            {log.map((l) => {
              const detail = (l.details?.name ?? l.details?.title ?? l.details?.email ?? "") as string;
              return (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-5 py-3">
                  <span className="min-w-0">
                    <span className="font-medium text-fg">{personName({ full_name: l.actor_name, email: null })}</span>{" "}
                    <span className="text-muted">{AUDIT_ACTIONS[l.action] ?? l.action}</span>{" "}
                    {detail && <span>{detail}</span>}
                  </span>
                  <time dateTime={l.created_at} className="shrink-0 text-xs text-subtle tabular-nums">{whenFmt.format(new Date(l.created_at))}</time>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
