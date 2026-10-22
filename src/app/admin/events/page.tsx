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
import { seriesEntries } from "@/lib/admin/series";
import { formatEventDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { EventStatus, OrbitEvent } from "@/types/database";

export const metadata: Metadata = { title: "Events · Admin" };

const PAGE_SIZE = 40;
const STATUSES: EventStatus[] = ["published", "draft", "cancelled", "expired", "removed"];
const selectClass = `${inputClass} !w-auto py-2 pr-8`;

type Row = Pick<
  OrbitEvent,
  | "id" | "title" | "starts_at" | "ends_at" | "status" | "is_featured" | "needs_review" | "source" | "source_url"
  | "organiser_id" | "registration_mode" | "cancel_reason" | "created_at" | "series_key" | "series_label"
> & {
  organiser: { id: string; name: string; slug: string; is_verified: boolean; status: string } | null;
  category: { name: string } | null;
};

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

const ROW_SELECT = `id, title, starts_at, ends_at, status, is_featured, needs_review, source, source_url, organiser_id,
  registration_mode, cancel_reason, created_at, series_key, series_label,
  organiser:organisers ( id, name, slug, is_verified, status ), category:categories ( name )`;

/** Rows one PostgREST request returns at most (`max_rows`); longer listings are read in ranges. */
const MAX_ROWS = 1000;

async function listAll<T>(read: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += MAX_ROWS) {
    const part = await read(from, from + MAX_ROWS - 1);
    rows.push(...part);
    if (part.length < MAX_ROWS) return rows;
  }
}

const chunk = <T,>(xs: T[], size: number) =>
  Array.from({ length: Math.ceil(xs.length / size) }, (_, i) => xs.slice(i * size, (i + 1) * size));

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
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const ascending = f.when === "upcoming";
  // Light columns of every matching event, to work out the pages; full rows follow for one page.
  const readListing = async (from: number, to: number) => {
    let q = supabase.from("events").select("id, series_key, starts_at");
    if (f.q) q = q.ilike("title", `%${f.q}%`);
    if ((STATUSES as string[]).includes(f.status)) q = q.eq("status", f.status);
    if (f.organiser === "none") q = q.is("organiser_id", null);
    else if (/^[0-9a-f-]{36}$/i.test(f.organiser)) q = q.eq("organiser_id", f.organiser);
    if (f.source) q = q.eq("source", f.source);
    if (f.review) q = q.eq("needs_review", true);
    // A duplicate copy is the same event from a second source: it's settled from Needs review.
    else q = q.is("duplicate_of", null);
    if (f.when === "upcoming") q = q.or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})`);
    if (f.when === "past") q = q.or(`ends_at.lt.${nowIso},and(ends_at.is.null,starts_at.lt.${nowIso})`);
    const { data, error } = await q.order("starts_at", { ascending }).order("id", { ascending }).range(from, to);
    if (error) throw error;
    return (data ?? []) as { id: string; series_key: string | null; starts_at: string }[];
  };

  const [listing, { data: orgs }, { data: sourceRows }, { data: sourceNameRows }, { data: categoryRows }] = await Promise.all([
    listAll(readListing),
    supabase.from("organisers").select("id, name").order("name"),
    supabase.from("events").select("source").neq("source", "orbit").limit(1000),
    supabase.from("event_sources").select("id, name").order("name"),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
  ]);

  // Page by event, not by date: a recurring event is one entry (where its first date sits)
  // carrying all of its dates, so its "N dates" dropdown is complete on whichever page it lands.
  const entries = seriesEntries(listing);
  const total = entries.length;
  const ids = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).flat();
  const fetched = await Promise.all(
    chunk(ids, 150).map(async (part) => {
      const { data, error } = await supabase.from("events").select(ROW_SELECT).in("id", part);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    }),
  );
  const byId = new Map(fetched.flat().map((r) => [r.id, r]));
  const rows = ids.map((id) => byId.get(id)).filter((r): r is Row => Boolean(r));
  const sourceNames = Object.fromEntries(
    ((sourceNameRows ?? []) as { id: string; name: string }[]).map((s) => [`source:${s.id}`, s.name]),
  );
  const sources = [...new Set(["orbit", "manual", "csv", ...(sourceRows ?? []).map((r) => r.source as string)])]
    .sort((a, b) => sourceLabel(a, sourceNames).localeCompare(sourceLabel(b, sourceNames)));
  const categories = (categoryRows ?? []) as { id: string; name: string }[];

  const { data: countRows } = rows.length
    ? await supabase.rpc("event_counts", { event_ids: rows.map((r) => r.id) })
    : { data: [] };
  const going = new Map(((countRows ?? []) as { event_id: string; going: number; pending: number }[]).map((c) => [c.event_id, c]));

  const filtered = Boolean(f.q || f.status || f.organiser || f.source || f.review || f.when !== "upcoming");

  const tableRows: EventTableRow[] = rows.map((e) => {
    const c = going.get(e.id);
    return {
      id: e.id,
      title: e.title,
      category: e.category?.name ?? null,
      featured: e.is_featured,
      needsReview: e.needs_review,
      when: formatEventDate(e.starts_at),
      organiser: e.organiser
        ? { name: e.organiser.name, verified: e.organiser.is_verified, status: e.organiser.status }
        : null,
      source: e.source,
      status: e.status as EventStatus,
      cancelReason: e.cancel_reason,
      registrationMode: e.registration_mode as EventTableRow["registrationMode"],
      going: c?.going ?? 0,
      pending: c?.pending ?? 0,
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
          {(orgs ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="ev-source">Source</label>
        <select id="ev-source" name="source" defaultValue={f.source} className={selectClass}>
          <option value="">Any source</option>
          {sources.map((s) => <option key={s} value={s}>{sourceLabel(s, sourceNames)}</option>)}
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
