import { Suspense } from "react";
import Form from "next/form";
import type { Metadata } from "next";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { Drawer } from "@/components/admin/Drawer";
import { IconSearch } from "@/components/admin/icons";
import { ApproveRejectButtons, OrganiserMenu } from "@/components/admin/OrganiserActions";
import { AdminHeader, CountTabs, Empty, SectionLabel, TableSkeleton, hrefWith, table } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/auth";
import { ORGANISER_STATUS } from "@/lib/admin/labels";
import { listOrganisersWithCounts, membersFor, personName, type AdminOrganiser, type MemberRow } from "@/lib/admin/queries";
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
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-subtle" />
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
                <OrganiserRow key={o.id} org={o} members={members.get(o.id) ?? []} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/** Who applied; older organisers didn't record it, so fall back to the first owner. */
function applicantOf(org: AdminOrganiser, members: MemberRow[]) {
  if (org.created_by_name || org.created_by_email) return { full_name: org.created_by_name, email: org.created_by_email };
  const owner = members.find((m) => m.role === "owner");
  return owner ? { full_name: owner.full_name, email: owner.email } : undefined;
}

function OrganiserRow({ org, members }: { org: AdminOrganiser; members: MemberRow[] }) {
  const applicant = applicantOf(org, members);
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
                <span className="flex items-center gap-1.5 font-medium transition-colors group-hover:text-accent">
                  {org.name} {org.is_verified && <VerifiedMark />}
                </span>
                <span className="block text-xs text-subtle">{org.university ?? `/${org.slug}`}</span>
              </span>
            </>
          }
        >
          <OrganiserDetails org={org} members={members} applicant={applicant} />
        </Drawer>
      </td>
      <td className={`${table.td} text-muted`}>{labelFor(ORGANISER_KINDS, org.kind).replace("University team / department", "University")}</td>
      <td className={`${table.td} text-muted`}>
        {org.contact_email ? <a href={`mailto:${org.contact_email}`} className="hover:text-fg">{org.contact_email}</a> : "—"}
      </td>
      <td className={table.td}>
        <span className="block">{applicant?.full_name ?? "—"}</span>
        <span className="block text-xs text-subtle">{applicant?.email}</span>
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

function OrganiserDetails({ org, members, applicant }: {
  org: AdminOrganiser; members: MemberRow[]; applicant?: { full_name: string | null; email: string | null };
}) {
  const status = ORGANISER_STATUS[org.status as OrganiserStatus];
  return (
    <div className="space-y-7 text-sm">
      <div className="flex items-center gap-3">
        <Avatar src={org.logo_url} name={org.name} size={56} />
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          {org.is_verified && <Badge tone="info">✓ Verified</Badge>}
          <Badge>{org.event_count} event{org.event_count === 1 ? "" : "s"}</Badge>
        </div>
      </div>

      {org.review_note && (
        <div className="rounded-2xl border border-orange/25 bg-orange/[0.06] p-4">
          <p className="text-xs font-medium text-orange">Review note</p>
          <p className="mt-1">{org.review_note}</p>
        </div>
      )}

      <section>
        <SectionLabel>About</SectionLabel>
        <p className="whitespace-pre-line text-fg/90">{org.bio || <span className="text-muted">No bio yet.</span>}</p>
      </section>

      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2.5 rounded-2xl border border-line bg-ink/[0.025] p-4">
        <dt className="text-subtle">Website</dt>
        <dd className="truncate">{org.website ? <a href={org.website} target="_blank" rel="noreferrer" className="text-accent transition-colors hover:underline">{org.website}</a> : "—"}</dd>
        <dt className="text-subtle">Contact</dt>
        <dd className="truncate">{org.contact_email ?? "—"}</dd>
        <dt className="text-subtle">University</dt>
        <dd>{org.university ?? "—"}</dd>
        <dt className="text-subtle">Applied by</dt>
        <dd>{applicant ? `${personName(applicant)}${applicant.email && applicant.full_name ? ` · ${applicant.email}` : ""}` : "—"}</dd>
        <dt className="text-subtle">Applied</dt>
        <dd>{dateFmt.format(new Date(org.created_at))}</dd>
        {org.reviewed_at && (
          <>
            <dt className="text-subtle">Reviewed</dt>
            <dd>{dateFmt.format(new Date(org.reviewed_at))}{org.reviewed_by_name ? ` by ${org.reviewed_by_name}` : ""}</dd>
          </>
        )}
        <dt className="text-subtle">Payments</dt>
        <dd>{org.stripe_charges_enabled ? "Stripe connected" : "Not connected"}</dd>
      </dl>

      <section>
        <SectionLabel>Team ({members.length})</SectionLabel>
        {members.length === 0 ? (
          <p className="text-muted">No members.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-ink/[0.025]">
            {members.map((m) => {
              return (
                <li key={m.user_id} className="flex items-center gap-3 px-3 py-2">
                  <Avatar src={null} name={personName(m)} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{personName(m)}</span>
                    <span className="block truncate text-xs text-muted">{m.email}</span>
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
          <ButtonLink href={`/o/${org.slug}`} variant="secondary" size="sm">Public page</ButtonLink>
        )}
        <ButtonLink href={hrefWith("/admin/events", { organiser: org.id, when: "all" })} variant="secondary" size="sm">
          Their events
        </ButtonLink>
      </div>
    </div>
  );
}
