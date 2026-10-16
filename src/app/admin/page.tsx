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
import { personName, profilesByIds } from "@/lib/admin/queries";
import type { AuditEntry } from "@/lib/admin/types";
import { formatEventDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

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

async function Content() {
  await requireAdmin();
  const supabase = await createClient();
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 864e5).toISOString();

  const [stats, signups, pendingOrgs, reviewEvents, soonEvents, audit] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.rpc("admin_signups_daily", { p_days: 30 }),
    supabase
      .from("organisers")
      .select("id, name, kind, university, status, is_verified, created_at")
      .eq("status", "pending")
      .order("created_at")
      .limit(6),
    supabase
      .from("events")
      .select("id, title, starts_at, source, status")
      .eq("needs_review", true)
      .not("status", "in", "(removed,expired)")
      .order("starts_at")
      .limit(6),
    supabase
      .from("events")
      .select("id, title, starts_at")
      .eq("status", "published")
      .eq("requires_approval", true)
      .gte("starts_at", now.toISOString())
      .lt("starts_at", weekAhead)
      .order("starts_at")
      .limit(20),
    supabase.from("admin_audit_log").select("*").order("created_at", { ascending: false }).limit(12),
  ]);

  const s = toStats(stats.data);
  const series = fillDailySeries(
    ((signups.data ?? []) as { day: string; signups: number }[]).map((r) => ({ day: r.day, count: r.signups })),
    30,
    ukDay(),
  );

  const soon = (soonEvents.data ?? []) as { id: string; title: string; starts_at: string }[];
  const { data: countRows } = soon.length
    ? await supabase.rpc("event_counts", { event_ids: soon.map((e) => e.id) })
    : { data: [] };
  const pendingByEvent = new Map(((countRows ?? []) as { event_id: string; pending: number }[]).map((c) => [c.event_id, c.pending]));
  const needsApproval = soon.map((e) => ({ ...e, pending: pendingByEvent.get(e.id) ?? 0 })).filter((e) => e.pending > 0);

  const orgs = (pendingOrgs.data ?? []) as { id: string; name: string; kind: string; university: string | null; status: string; is_verified: boolean; created_at: string }[];
  const reviews = (reviewEvents.data ?? []) as { id: string; title: string; starts_at: string; source: string }[];
  const log = (audit.data ?? []) as AuditEntry[];
  const people = await profilesByIds(log.map((l) => l.actor));
  const attention = s.organisers_pending + s.needs_review + needsApproval.length;

  return (
    <div className="space-y-5">
      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
        <KpiTile label="Upcoming events" value={compactNumber(s.upcoming_events)} hint="Published, not yet finished" href="/admin/events" accent />
        <KpiTile label="Events this week" value={s.events_this_week} hint="Starting in the next 7 days" href="/admin/events?when=upcoming" />
        <KpiTile label="Registrations" value={compactNumber(s.registrations)} hint={`${s.registrations_7d} in the last 7 days`} />
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
                        <ApproveRejectButtons org={o as never} />
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
                          <span className="block text-xs text-muted">{whenFmt.format(new Date(e.starts_at))} · {e.source}</span>
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
                    <span className="font-medium text-fg">{personName(l.actor ? people.get(l.actor) : null)}</span>{" "}
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
