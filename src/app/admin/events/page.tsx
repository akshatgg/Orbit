import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { AutoSubmitForm } from "@/components/admin/AutoSubmitForm";
import { EventsTable, type EventTableRow } from "@/components/admin/EventsTable";
import { IconPlus, IconSearch, IconUpload } from "@/components/admin/icons";
import { AdminHeader, Empty, Pagination, TableSkeleton, hrefWith } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/auth";
import { EVENT_STATUS, sanitiseSearch, sourceLabel } from "@/lib/admin/labels";
import { authed } from "@/lib/api/session";
import { formatEventDate } from "@/lib/format";
import type { EventStatus, OrbitEvent } from "@/types/database";

export const metadata: Metadata = { title: "Events · Admin" };

const PAGE_SIZE = 40;
const STATUSES: EventStatus[] = ["published", "draft", "cancelled", "expired", "removed"];
const selectClass = `${inputClass} !w-auto py-2 pr-8`;

/** One row of `GET /admin/events`: every date of each series on the page, in listing order. */
type Row = Pick<
  OrbitEvent,
  | "id" | "title" | "starts_at" | "ends_at" | "status" | "is_featured" | "needs_review" | "source" | "source_url"
  | "organiser_id" | "registration_mode" | "cancel_reason" | "created_at" | "series_key" | "series_label"
> & {
  organiser_name: string | null;
  category_name: string | null;
  source_name: string;
  going: number;
  pending: number;
};

type AdminOrganiserOption = { id: string; name: string; is_verified: boolean; status: string };
type SourceOption = { key: string; label: string };

export default function Page({ searchParams }: PageProps<"/admin/events">) {
  return (
    <>
      <AdminHeader
        eyebrow="Moderation"
        title="Events"
        subtitle="Every event on ORBIT — feature the best, fix or remove the rest."
        action={
          <>
            <ButtonLink href="/admin/import" variant="secondary" size="md"><IconUpload size={15} /> CSV import</ButtonLink>
            <ButtonLink href="/admin/events/new" size="md" className=""><IconPlus size={15} /> Add event</ButtonLink>
          </>
        }
      />
      <Suspense fallback={<TableSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
      <Toaster />
    </>
  );
}

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

const ukWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "Europe/London" });

async function Content({ searchParams }: { searchParams: PageProps<"/admin/events">["searchParams"] }) {
  await requireAdmin();
  const sp = await searchParams;
  const f = {
    q: sanitiseSearch(str(sp.q)),
    status: str(sp.status),
    organiser: str(sp.organiser),
    source: str(sp.source),
    review: str(sp.review) === "1" ? "1" : "",
    when: ["upcoming", "past", "all"].includes(str(sp.when)) ? str(sp.when) : "upcoming",
  };
  const page = Math.max(1, Number.parseInt(str(sp.page), 10) || 1);

  const [listing, organisers, sources, categoryPage] = await Promise.all([
    authed.get<{ items: Row[]; total: number }>("/admin/events", {
      query: {
        q: f.q,
        status: (STATUSES as string[]).includes(f.status) ? f.status : undefined,
        organiser_id: f.organiser === "none" || /^[0-9a-f-]{36}$/i.test(f.organiser) ? f.organiser : undefined,
        source: f.source,
        review: f.review ? true : undefined,
        when: f.when,
        page,
        page_size: PAGE_SIZE,
      },
    }),
    authed.get<{ items: AdminOrganiserOption[] }>("/admin/organisers"),
    authed.get<SourceOption[]>("/admin/events/sources"),
    authed.get<{ items: { id: string; name: string }[] }>("/admin/categories"),
  ]);

  const rows = listing.items;
  // Paged by event, not by date: a recurring event is one entry carrying all of its dates.
  const total = listing.total;
  const sourceNames = Object.fromEntries(sources.filter((s) => s.key.startsWith("source:")).map((s) => [s.key, s.label]));
  if (f.source && !sources.some((s) => s.key === f.source)) {
    sources.push({ key: f.source, label: sourceLabel(f.source, sourceNames) });
  }
  const categories = categoryPage.items.map((c) => ({ id: c.id, name: c.name }));
  const orgs = [...organisers.items].sort((a, b) => a.name.localeCompare(b.name));
  const orgById = new Map(orgs.map((o) => [o.id, o]));

  const filtered = Boolean(f.q || f.status || f.organiser || f.source || f.review || f.when !== "upcoming");

  const tableRows: EventTableRow[] = rows.map((e) => {
    const organiser = e.organiser_id ? orgById.get(e.organiser_id) : undefined;
    return {
      id: e.id,
      title: e.title,
      category: e.category_name,
      featured: e.is_featured,
      needsReview: e.needs_review,
      when: formatEventDate(e.starts_at),
      organiser: e.organiser_id
        ? {
          name: organiser?.name ?? e.organiser_name ?? "Unknown organiser",
          verified: organiser?.is_verified ?? false,
          status: organiser?.status ?? "approved",
        }
        : null,
      source: e.source,
      status: e.status as EventStatus,
      cancelReason: e.cancel_reason,
      registrationMode: e.registration_mode as EventTableRow["registrationMode"],
      going: e.going ?? 0,
      pending: e.pending ?? 0,
      organiserId: e.organiser_id,
      sourceUrl: e.source_url,
      seriesKey: e.series_key,
      seriesLabel: e.series_label,
      weekday: ukWeekday.format(new Date(e.starts_at)),
    };
  });

  return (
    <>
      <AutoSubmitForm action="/admin/events" className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-subtle" />
          <label htmlFor="ev-q" className="sr-only">Search events by title</label>
          <input id="ev-q" name="q" defaultValue={f.q} placeholder="Search titles" className={`${inputClass} py-2 pl-9`} />
        </div>
        <label className="sr-only" htmlFor="ev-when">When</label>
        <select id="ev-when" name="when" defaultValue={f.when} className={selectClass}>
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">Any time</option>
        </select>
        <label className="sr-only" htmlFor="ev-status">Status</label>
        <select id="ev-status" name="status" defaultValue={f.status} className={selectClass}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{EVENT_STATUS[s].label}</option>)}
        </select>
        <label className="sr-only" htmlFor="ev-org">Organiser</label>
        <select id="ev-org" name="organiser" defaultValue={f.organiser} className={`${selectClass} max-w-52`}>
          <option value="">All organisers</option>
          <option value="none">No organiser (admin-added)</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="ev-source">Source</label>
        <select id="ev-source" name="source" defaultValue={f.source} className={selectClass}>
          <option value="">Any source</option>
          {sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <label className="flex h-[38px] cursor-pointer items-center gap-2 rounded-[14px] border border-ink/10 bg-ink/[0.045] px-3.5 text-sm text-muted transition-colors hover:border-ink/15 has-checked:border-orange/40 has-checked:bg-orange/10 has-checked:text-orange">
          <input type="checkbox" name="review" value="1" defaultChecked={!!f.review} className="accent-orange" />
          Needs review
        </label>
        {filtered && <Link href="/admin/events" className="px-2 text-sm text-muted transition-colors hover:text-fg">Reset</Link>}
        <button type="submit" className="sr-only">Apply filters</button>
      </AutoSubmitForm>

      {rows.length === 0 ? (
        <Empty
          title={filtered ? "No events match" : "No upcoming events"}
          action={<ButtonLink href="/admin/events/new" size="sm"><IconPlus size={14} /> Add event</ButtonLink>}
        >
          {filtered ? "Try widening the filters." : "Add one by hand or import a CSV."}
        </Empty>
      ) : (
        <>
          <EventsTable rows={tableRows} categories={categories} sourceNames={sourceNames} />
          <Pagination
            page={page}
            pageCount={Math.ceil(total / PAGE_SIZE)}
            total={total}
            noun="event"
            hrefFor={(p) => hrefWith("/admin/events", { ...f, page: p })}
          />
        </>
      )}
    </>
  );
}
