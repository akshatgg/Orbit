import { Suspense } from "react";
import Form from "next/form";
import Link from "next/link";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { inputClass } from "@/components/ui/Field";
import { Drawer } from "@/components/admin/Drawer";
import { IconSearch } from "@/components/admin/icons";
import { ApproveRejectButtons, OrganiserMenu } from "@/components/admin/OrganiserActions";
import { AdminHeader, CountTabs, Empty, TableSkeleton, hrefWith, table } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/auth";
import { ORGANISER_STATUS } from "@/lib/admin/labels";
import {
  listOrganisersWithCounts, membersFor, personName, profilesByIds, type AdminOrganiser, type MemberRow, type PersonLite,
} from "@/lib/admin/queries";
import { labelFor, ORGANISER_KINDS } from "@/lib/taxonomy";
import type { OrganiserStatus } from "@/types/database";

export const metadata: Metadata = { title: "Organisers · Admin" };

const TABS: OrganiserStatus[] = ["pending", "approved", "rejected", "suspended"];
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/London" });

export default function Page({ searchParams }: PageProps<"/admin/organisers">) {
  return (
    <>
      <AdminHeader eyebrow="Moderation" title="Organisers" subtitle="Approve applications, give verified badges, suspend bad actors." />
      <Suspense fallback={<TableSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
      <Toaster />
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/organisers">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const tab = (TABS as string[]).includes(String(sp.tab)) ? (sp.tab as OrganiserStatus) : "pending";
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";

  const all = await listOrganisersWithCounts();
  const counts = Object.fromEntries(TABS.map((s) => [s, all.filter((o) => o.status === s).length])) as Record<OrganiserStatus, number>;
  const rows = all
    .filter((o) => o.status === tab)
    .filter((o) => !q || [o.name, o.slug, o.contact_email, o.university].some((v) => v?.toLowerCase().includes(q)));
  if (tab === "pending") rows.reverse(); // oldest application first

  const members = await membersFor(rows.map((o) => o.id));
  const people = await profilesByIds([
    ...rows.flatMap((o) => [o.created_by, o.reviewed_by]),
    ...[...members.values()].flat().map((m) => m.user_id),
  ]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <CountTabs
          label="Organiser status"
          items={TABS.map((s) => ({
            key: s, label: ORGANISER_STATUS[s].label, count: counts[s],
            href: hrefWith("/admin/organisers", { tab: s, q }), active: s === tab,
          }))}
        />
        <Form action="/admin/organisers" className="relative mb-4 w-full sm:w-64">
          <input type="hidden" name="tab" value={tab} />
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="org-search" className="sr-only">Search organisers</label>
          <input id="org-search" name="q" defaultValue={q} placeholder="Search name, email, slug" className={`${inputClass} py-2 pl-9`} />
        </Form>
      </div>

      {rows.length === 0 ? (
        <Empty title={q ? "No matches" : tab === "pending" ? "Inbox zero" : `No ${ORGANISER_STATUS[tab].label.toLowerCase()} organisers`}>
          {q ? "Try a different search." : tab === "pending" ? "New organiser applications will show up here." : null}
        </Empty>
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.th}>Organiser</th>
                <th className={table.th}>Kind</th>
                <th className={table.th}>Contact</th>
                <th className={table.th}>Applicant</th>
                <th className={table.th}>{tab === "pending" ? "Applied" : "Reviewed"}</th>
                <th className={`${table.th} text-right`}>Events</th>
                <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <OrganiserRow key={o.id} org={o} members={members.get(o.id) ?? []} people={people} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function OrganiserRow({ org, members, people }: { org: AdminOrganiser; members: MemberRow[]; people: Map<string, PersonLite> }) {
  const applicant = org.created_by ? people.get(org.created_by) : undefined;
  const reviewer = org.reviewed_by ? people.get(org.reviewed_by) : undefined;
  return (
    <tr className={table.tr}>
      <td className={table.td}>
        <Drawer
          title={org.name}
          subtitle={<>/{org.slug} · {labelFor(ORGANISER_KINDS, org.kind)}</>}
          triggerClassName="group flex items-center gap-3 text-left"
          trigger={
            <>
              <Avatar src={org.logo_url} name={org.name} size={36} />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-medium group-hover:underline">
                  {org.name} {org.is_verified && <VerifiedMark />}
                </span>
                <span className="block text-xs text-muted">{org.university ?? `/${org.slug}`}</span>
              </span>
            </>
          }
        >
          <OrganiserDetails org={org} members={members} people={people} applicant={applicant} reviewer={reviewer} />
        </Drawer>
      </td>
      <td className={`${table.td} text-muted`}>{labelFor(ORGANISER_KINDS, org.kind).replace("University team / department", "University")}</td>
      <td className={`${table.td} text-muted`}>
        {org.contact_email ? <a href={`mailto:${org.contact_email}`} className="hover:text-fg">{org.contact_email}</a> : "—"}
      </td>
      <td className={table.td}>
        <span className="block">{applicant?.full_name ?? "—"}</span>
        <span className="block text-xs text-muted">{applicant?.email}</span>
      </td>
      <td className={`${table.td} whitespace-nowrap text-muted tabular-nums`}>
        {dateFmt.format(new Date(org.status === "pending" ? org.created_at : org.reviewed_at ?? org.created_at))}
      </td>
      <td className={`${table.td} text-right tabular-nums`}>{org.event_count}</td>
      <td className={`${table.td} text-right`}>
        <div className="flex items-center justify-end gap-1.5">
          {org.status === "pending" && <ApproveRejectButtons org={org} />}
          <OrganiserMenu org={org} />
        </div>
      </td>
    </tr>
  );
}

function OrganiserDetails({ org, members, people, applicant, reviewer }: {
  org: AdminOrganiser; members: MemberRow[]; people: Map<string, PersonLite>; applicant?: PersonLite; reviewer?: PersonLite;
}) {
  const status = ORGANISER_STATUS[org.status as OrganiserStatus];
  return (
    <div className="space-y-6 text-sm">
      <div className="flex items-center gap-3">
        <Avatar src={org.logo_url} name={org.name} size={56} />
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {org.is_verified && <Badge tone="info">✓ Verified</Badge>}
          <Badge>{org.event_count} event{org.event_count === 1 ? "" : "s"}</Badge>
        </div>
      </div>

      {org.review_note && (
        <div className="rounded-xl border border-orange/30 bg-orange/5 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-orange">Review note</p>
          <p className="mt-1">{org.review_note}</p>
        </div>
      )}

      <section>
        <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">About</h3>
        <p className="whitespace-pre-line text-fg/90">{org.bio || <span className="text-muted">No bio yet.</span>}</p>
      </section>

      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
        <dt className="text-muted">Website</dt>
        <dd className="truncate">{org.website ? <a href={org.website} target="_blank" rel="noreferrer" className="text-blue hover:underline">{org.website}</a> : "—"}</dd>
        <dt className="text-muted">Contact</dt>
        <dd className="truncate">{org.contact_email ?? "—"}</dd>
        <dt className="text-muted">University</dt>
        <dd>{org.university ?? "—"}</dd>
        <dt className="text-muted">Applied by</dt>
        <dd>{applicant ? `${personName(applicant)}${applicant.email && applicant.full_name ? ` · ${applicant.email}` : ""}` : "—"}</dd>
        <dt className="text-muted">Applied</dt>
        <dd>{dateFmt.format(new Date(org.created_at))}</dd>
        {org.reviewed_at && (
          <>
            <dt className="text-muted">Reviewed</dt>
            <dd>{dateFmt.format(new Date(org.reviewed_at))}{reviewer ? ` by ${personName(reviewer)}` : ""}</dd>
          </>
        )}
        <dt className="text-muted">Payments</dt>
        <dd>{org.stripe_charges_enabled ? "Stripe connected" : "Not connected"}</dd>
      </dl>

      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Team ({members.length})</h3>
        {members.length === 0 ? (
          <p className="text-muted">No members.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {members.map((m) => {
              const p = people.get(m.user_id);
              return (
                <li key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar src={p?.avatar_url} name={personName(p)} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{personName(p)}</span>
                    <span className="block truncate text-xs text-muted">{p?.email}</span>
                  </span>
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{m.role}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        {org.status === "approved" && (
          <Link href={`/o/${org.slug}`} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface-2">Public page</Link>
        )}
        <Link href={hrefWith("/admin/events", { organiser: org.id, when: "all" })} className="rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-surface-2">
          Their events
        </Link>
      </div>
    </div>
  );
}
