import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { AutoSubmitForm } from "@/components/admin/AutoSubmitForm";
import { EventMenu } from "@/components/admin/EventActions";
import { IconFlag, IconPlus, IconSearch, IconStar, IconUpload } from "@/components/admin/icons";
import { AdminHeader, Empty, Pagination, TableSkeleton, hrefWith, table } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/auth";
import { EVENT_STATUS, sanitiseSearch, sourceLabel } from "@/lib/admin/labels";
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
  | "organiser_id" | "registration_mode" | "cancel_reason" | "created_at"
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

  let query = supabase
    .from("events")
    .select(
      `id, title, starts_at, ends_at, status, is_featured, needs_review, source, source_url, organiser_id,
       registration_mode, cancel_reason, created_at,
       organiser:organisers ( id, name, slug, is_verified, status ), category:categories ( name )`,
      { count: "exact" },
    );
  if (f.q) query = query.ilike("title", `%${f.q}%`);
  if ((STATUSES as string[]).includes(f.status)) query = query.eq("status", f.status);
  if (f.organiser === "none") query = query.is("organiser_id", null);
  else if (/^[0-9a-f-]{36}$/i.test(f.organiser)) query = query.eq("organiser_id", f.organiser);
  if (f.source) query = query.eq("source", f.source);
  if (f.review) query = query.eq("needs_review", true);
  if (f.when === "upcoming") query = query.or(`ends_at.gte.${nowIso},and(ends_at.is.null,starts_at.gte.${nowIso})`);
  if (f.when === "past") query = query.or(`ends_at.lt.${nowIso},and(ends_at.is.null,starts_at.lt.${nowIso})`);
  query = query.order("starts_at", { ascending: f.when === "upcoming" }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data, count, error }, { data: orgs }, { data: sourceRows }] = await Promise.all([
    query,
    supabase.from("organisers").select("id, name").order("name"),
    supabase.from("events").select("source").neq("source", "orbit").limit(1000),
  ]);
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const sources = [...new Set(["orbit", "manual", "csv", ...(sourceRows ?? []).map((r) => r.source as string)])];

  const { data: countRows } = rows.length
    ? await supabase.rpc("event_counts", { event_ids: rows.map((r) => r.id) })
    : { data: [] };
  const going = new Map(((countRows ?? []) as { event_id: string; going: number; pending: number }[]).map((c) => [c.event_id, c]));

  const filtered = Boolean(f.q || f.status || f.organiser || f.source || f.review || f.when !== "upcoming");

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
          {sources.map((s) => <option key={s} value={s}>{sourceLabel(s)}</option>)}
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
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Event</th>
                  <th className={table.th}>When</th>
                  <th className={table.th}>Organiser</th>
                  <th className={table.th}>Source</th>
                  <th className={table.th}>Status</th>
                  <th className={`${table.th} text-right`}>Going</th>
                  <th className={table.th}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => {
                  const st = EVENT_STATUS[e.status as EventStatus];
                  const c = going.get(e.id);
                  return (
                    <tr key={e.id} className={`${table.tr} ${e.status === "removed" ? "opacity-60" : ""}`}>
                      <td className={`${table.td} min-w-52 max-w-80`}>
                        <Link href={`/events/${e.id}`} target="_blank" className="line-clamp-1 font-medium transition-colors hover:text-accent">{e.title}</Link>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
                          {e.category?.name ?? "No category"}
                          {e.is_featured && <Badge tone="brand"><IconStar size={11} /> Featured</Badge>}
                          {e.needs_review && <Badge tone="warning"><IconFlag size={11} /> Needs review</Badge>}
                        </span>
                      </td>
                      <td className={`${table.td} whitespace-nowrap text-muted tabular-nums`}>{formatEventDate(e.starts_at)}</td>
                      <td className={table.td}>
                        {e.organiser ? (
                          <span className="flex items-center gap-1.5">
                            <span className="line-clamp-1">{e.organiser.name}</span>
                            {e.organiser.is_verified && <VerifiedMark />}
                            {e.organiser.status !== "approved" && <Badge tone="warning">{e.organiser.status}</Badge>}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className={`${table.td} text-muted`}>{sourceLabel(e.source)}</td>
                      <td className={table.td}>
                        <span title={e.cancel_reason ?? undefined}><Badge tone={st.tone}>{st.label}</Badge></span>
                      </td>
                      <td className={`${table.td} text-right tabular-nums`}>
                        {e.registration_mode === "tickets" ? (
                          <>
                            {c?.going ?? 0}
                            {c?.pending ? <span className="ml-1 text-xs text-orange" title="Awaiting approval">+{c.pending}</span> : null}
                          </>
                        ) : (
                          <span className="text-xs text-muted">{e.registration_mode === "external" ? "external" : "info"}</span>
                        )}
                      </td>
                      <td className={`${table.td} text-right`}><EventMenu event={e} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
