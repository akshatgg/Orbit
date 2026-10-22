import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import {
  AdminHeader, CountTabs, Empty, KpiTile, Pagination, SegmentedLinks, TableSkeleton, hrefWith, table,
} from "@/components/admin/primitives";
import { IconCheck, IconExternal, IconEyeOff, IconPencil, IconPlay, IconPlus, IconTrash } from "@/components/admin/icons";
import { MenuLink, MenuSeparator, RowMenu } from "@/components/admin/RowMenu";
import {
  eventCountsBySource, latestRunBySource, listDuplicateReview, listHiddenDuplicates, listImportedEvents, listMissingReview, listRecentRuns,
  listSources, reviewCounts, sourceLabels, type SourceWithDefaults,
} from "@/lib/sources/queries";
import { startsInLabel } from "@/lib/sources/review";
import { SOURCE_KIND_LABELS, type SourceRun } from "@/lib/sources/types";
import type { SourceEventCount } from "@/lib/sources/queries";
import { ActionButton } from "./_components/ActionButton";
import { ImportedEventRow } from "./_components/ImportedEventRow";
import { RefreshAllButton } from "./_components/RefreshAllButton";
import { ReviewCard } from "./_components/ReviewCard";
import { ReviewSelection, RowCheckbox } from "./_components/ReviewSelection";
import { markReviewedBulk, resolveReview, retryPageDetails, runSourceNow, saveImportedDetails, setSourceEnabled } from "./actions";
import { deleteSource } from "./delete-source";

export const metadata = { title: "Event sources · ORBIT admin" };

// Always UK time: the server runs in UTC.
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }) : "Never";
const startsAt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

const host = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

const runSummary = (run: SourceRun | undefined) =>
  run
    ? `${run.found} found · ${run.inserted} new · ${run.updated} updated · ${run.unchanged} same${run.flagged_missing ? ` · ${run.flagged_missing} flagged` : ""}${run.enriched ? ` · ${run.enriched} with details` : ""}`
    : "—";

/**
 * Per-feed actions: Run now stays visible (it's the one used daily); edit, enable/disable and
 * delete sit in the ⋯ menu so a row never turns into a wall of buttons.
 */
function SourceActions({ source, align = "end", className = "" }: {
  source: SourceWithDefaults; align?: "start" | "end"; className?: string;
}) {
  return (
    <div className={`flex items-start gap-1.5 ${align === "end" ? "justify-end" : "justify-start"} ${className}`}>
      <ActionButton action={runSourceNow} fields={{ id: source.id }} pendingText="Running…" size="sm" resultClassName="max-w-44 whitespace-normal">
        <IconPlay size={13} /> Run now
      </ActionButton>
      <RowMenu label={`More actions for ${source.name}`}>
        <MenuLink href={`/admin/sources/${source.id}/edit`}><IconPencil size={15} /> Edit</MenuLink>
        <MenuLink href={source.url} external><IconExternal size={15} /> Open feed link</MenuLink>
        <MenuSeparator />
        {source.enabled ? (
          <ActionButton
            menuItem action={setSourceEnabled} fields={{ id: source.id, enabled: "false" }}
            confirm={{ title: `Disable ${source.name}?`, body: "It won't refresh any more. Its events stay in ORBIT.", confirmLabel: "Disable" }}
          ><IconEyeOff size={15} /> Disable</ActionButton>
        ) : (
          <ActionButton
            menuItem action={setSourceEnabled} fields={{ id: source.id, enabled: "true" }}
            confirm={{ title: `Enable ${source.name}?`, body: "It will be fetched every night. Only enable feeds you have permission to use.", confirmLabel: "Enable" }}
          ><IconCheck size={15} /> Enable</ActionButton>
        )}
        <ActionButton
          menuItem action={deleteSource} fields={{ id: source.id }} variant="danger" pendingText="Deleting…"
          confirm={{
            title: `Delete ${source.name}?`,
            body: "The feed and its run history are removed. If you tick the box, its upcoming events are permanently deleted, including their registrations and tickets. This cannot be undone.",
            confirmLabel: "Delete source",
          }}
          extra={
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="remove_events" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
              Also permanently delete its upcoming events
            </label>
          }
        ><IconTrash size={15} /> Delete…</ActionButton>
      </RowMenu>
    </div>
  );
}

/** "9" with "67 dates" under it when a source's events repeat; just the number otherwise. */
function EventCount({ count }: { count: SourceEventCount | undefined }) {
  const { events = 0, dates = 0 } = count ?? {};
  return (
    <span className="tabular-nums">
      {events}
      {dates > events && <span className="block whitespace-nowrap text-xs text-muted">{dates} dates</span>}
    </span>
  );
}

function FeedCard({ source, run, eventCount }: { source: SourceWithDefaults; run: SourceRun | undefined; eventCount: SourceEventCount | undefined }) {
  return (
    <article className="glass rounded-[20px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/admin/sources/${source.id}/edit`} className="truncate text-[15px] font-semibold transition-colors hover:text-accent">
              {source.name}
            </Link>
            <Badge tone="brand">{SOURCE_KIND_LABELS[source.kind]}</Badge>
          </div>
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1 truncate text-xs text-muted transition-colors hover:text-fg"
            title={source.url}
          >
            {host(source.url)}
          </a>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge tone={source.enabled ? "success" : "neutral"}>{source.enabled ? "Enabled" : "Disabled"}</Badge>
          {source.last_status && <Badge tone={source.last_status === "ok" ? "success" : "danger"}>{source.last_status}</Badge>}
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-ink/[0.035] p-3.5 text-xs">
        <div>
          <dt className="text-subtle">Last run</dt>
          <dd className="mt-0.5 text-muted">{when(source.last_run_at)}</dd>
        </div>
        <div>
          <dt className="text-subtle">Events</dt>
          <dd className="mt-0.5"><EventCount count={eventCount} /></dd>
        </div>
        <div>
          <dt className="text-subtle">Permission</dt>
          <dd className={`mt-0.5 ${source.permission_confirmed ? "text-muted" : "text-orange"}`}>
            {source.permission_confirmed ? "Recorded" : "Missing"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-2 text-xs">
        <p className="text-muted"><span className="text-subtle">Last result: </span>{runSummary(run)}</p>
      </div>

      {source.last_error && (
        <p className="mt-3 break-words rounded-xl border border-red-400/15 bg-red-500/5 px-3 py-2 text-xs text-red-300">
          {source.last_error}
        </p>
      )}

      <SourceActions source={source} align="start" className="mt-4 border-t border-line/70 pt-3" />
    </article>
  );
}

const TABS = ["sources", "missing", "duplicates", "hidden", "imported", "runs"] as const;
type Tab = (typeof TABS)[number];
const PATH = "/admin/sources";
const MISSING_PAGE = 50;
const DUPLICATES_PAGE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SourcesPage({ searchParams }: PageProps<"/admin/sources">) {
  return (
    <>
      <AdminHeader
        eyebrow="Events"
        title="Sources"
        subtitle="Calendar feeds and discovery links, refreshed nightly. Only sources we have permission to use."
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-start">
            <RefreshAllButton className="w-full sm:w-auto sm:items-end" />
            <ButtonLink href="/admin/sources/new" size="md" className="w-full sm:w-auto">
              <IconPlus size={15} /> Add source
            </ButtonLink>
          </div>
        }
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/admin/sources">["searchParams"] }) {
  await connection();
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab: Tab = TABS.includes(one(sp.tab) as Tab) ? (one(sp.tab) as Tab) : "sources";
  const page = Math.max(1, Math.floor(Number(one(sp.page)) || 1));
  const source = UUID.test(one(sp.source) ?? "") ? one(sp.source)! : null;

  const sources = await listSources();
  const [counts, eventCounts] = await Promise.all([reviewCounts(), eventCountsBySource(sources.map((s) => s.id))]);
  const enabled = sources.filter((s) => s.enabled).length;
  const totalEvents = [...eventCounts.values()].reduce((sum, c) => sum + c.events, 0);
  const lastRefresh = sources.map((s) => s.last_run_at).filter((v): v is string => !!v).sort().at(-1) ?? null;
  const errors = sources.filter((s) => s.last_status === "error").length;
  const href = (t: Tab) => hrefWith(PATH, { tab: t === "sources" ? null : t });

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile
          label="Missing from feed" value={counts.missing} href={href("missing")} alert={counts.missing > 0}
          hint={counts.missing ? "waiting for a decision" : "nothing waiting"}
        />
        <KpiTile
          label="Possible duplicates" value={counts.duplicates} href={href("duplicates")} alert={counts.duplicates > 0}
          hint={counts.duplicates ? "compare and decide" : "nothing waiting"}
        />
        <KpiTile label="Sources" value={`${enabled}/${sources.length}`} hint="enabled" href={href("sources")} />
        <KpiTile label="Imported events" value={totalEvents} hint="across all sources" href={href("imported")} />
        <KpiTile
          label="Last refresh" value={lastRefresh ? when(lastRefresh) : "Never"} href={href("runs")} alert={errors > 0}
          hint={errors ? `${errors} source error${errors === 1 ? "" : "s"}` : "all sources healthy"}
        />
      </div>

      <CountTabs
        label="Sources dashboard"
        items={[
          { key: "sources", label: "Sources", count: sources.length },
          { key: "missing", label: "Missing from feed", count: counts.missing },
          { key: "duplicates", label: "Possible duplicates", count: counts.duplicates },
          { key: "hidden", label: "Hidden duplicates", count: counts.hidden },
          { key: "imported", label: "Imported events" },
          { key: "runs", label: "Runs" },
        ].map((t) => ({ ...t, href: href(t.key as Tab), active: t.key === tab }))}
      />

      <Suspense key={`${tab}-${page}-${source}`} fallback={<TableSkeleton rows={6} />}>
        {tab === "sources" && <SourcesTab sources={sources} eventCounts={eventCounts} />}
        {tab === "missing" && <MissingTab page={page} source={source} />}
        {tab === "duplicates" && <DuplicatesTab page={page} />}
        {tab === "hidden" && <HiddenTab />}
        {tab === "imported" && <ImportedTab />}
        {tab === "runs" && <RunsTab />}
      </Suspense>
    </>
  );
}

function TabIntro({ children }: { children: React.ReactNode }) {
  return <p className="mb-4 max-w-3xl text-sm text-muted">{children}</p>;
}

// ─── Sources ───────────────────────────────────────────────────────────────

async function SourcesTab({ sources, eventCounts }: {
  sources: SourceWithDefaults[]; eventCounts: Map<string, SourceEventCount>;
}) {
  if (sources.length === 0) {
    return (
      <Empty title="No sources yet" action={<ButtonLink href="/admin/sources/new" size="sm">Add the first source</ButtonLink>}>
        Add an iCal feed, or a Luma, Meetup, Eventbrite or Fatsoma link the owner has agreed we can use.
      </Empty>
    );
  }
  const latest = await latestRunBySource(sources.map((s) => s.id));
  return (
    <>
      {/* Up to 2xl: cards. The table is only used when there is room for every column. */}
      <ul className="grid gap-3 lg:grid-cols-2 2xl:hidden">
        {sources.map((s) => (
          <li key={s.id}>
            <FeedCard source={s} run={latest.get(s.id)} eventCount={eventCounts.get(s.id)} />
          </li>
        ))}
      </ul>

      {/* Very wide screens: the full table. */}
      <div className={`${table.wrap} hidden 2xl:block`}>
        <table className={`${table.table} min-w-[62rem]`}>
          <thead>
            <tr>
              {["Name", "Type", "Feed", "State", "Last run", "Last result", "Events"].map((h) => <th key={h} className={table.th}>{h}</th>)}
              <th className={table.th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="align-top">
            {sources.map((s) => (
              <tr key={s.id} className={table.tr}>
                <td className={`${table.td} min-w-40 font-medium`}>
                  <Link href={`/admin/sources/${s.id}/edit`} className="transition-colors hover:text-accent">{s.name}</Link>
                  {!s.permission_confirmed && <div className="mt-1"><Badge tone="warning">No permission recorded</Badge></div>}
                </td>
                <td className={table.td}><Badge tone="brand">{SOURCE_KIND_LABELS[s.kind]}</Badge></td>
                <td className={`${table.td} text-muted`}><a href={s.url} className="transition-colors hover:text-fg" rel="noreferrer" target="_blank" title={s.url}>{host(s.url)}</a></td>
                <td className={table.td}>{s.enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>}</td>
                <td className={`${table.td} whitespace-nowrap text-muted tabular-nums`}>
                  {when(s.last_run_at)}
                  {s.last_status && <div className="mt-1"><Badge tone={s.last_status === "ok" ? "success" : "danger"}>{s.last_status}</Badge></div>}
                </td>
                <td className={`${table.td} max-w-[18rem] text-xs text-muted`}>
                  {runSummary(latest.get(s.id))}
                  {s.last_error && <p className="mt-1 max-w-xs break-words text-red-300">{s.last_error}</p>}
                </td>
                <td className={table.td}><EventCount count={eventCounts.get(s.id)} /></td>
                <td className={`${table.td} w-px whitespace-nowrap`}><SourceActions source={s} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Missing from feed ─────────────────────────────────────────────────────

async function MissingTab({ page, source }: { page: number; source: string | null }) {
  const { items, total, sources } = await listMissingReview({ page, pageSize: MISSING_PAGE, sourceId: source });
  const all = sources.reduce((sum, s) => sum + s.count, 0);
  if (all === 0) {
    return <Empty title="Nothing missing">Events that drop out of their feed on a later day show up here for you to keep or take down.</Empty>;
  }
  const pageHref = (p: number) => hrefWith(PATH, { tab: "missing", source, page: p > 1 ? p : null });

  return (
    <>
      <TabIntro>
        The last successful refresh didn&rsquo;t include these. They stay live until you decide. Soonest first; events that
        vanish on their own day aren&rsquo;t listed, because they&rsquo;ve simply closed registration.
      </TabIntro>
      {sources.length > 1 && (
        <div className="mb-4">
          <SegmentedLinks
            label="Filter by source"
            items={[
              { key: "all", label: `All · ${all}`, href: hrefWith(PATH, { tab: "missing" }), active: !source },
              ...sources.map((s) => ({ key: s.id, label: `${s.name} · ${s.count}`, href: hrefWith(PATH, { tab: "missing", source: s.id }), active: source === s.id })),
            ]}
          />
        </div>
      )}
      <ReviewSelection ids={items.map((i) => i.event.id)} action={markReviewedBulk}>
        <div className={table.wrap}>
          <table className={`${table.table} min-w-[52rem]`}>
            <thead>
              <tr>
                <th className={`${table.th} w-10`}><span className="sr-only">Select</span></th>
                {["Event", "Starts", "When", "Source", "Why"].map((h) => <th key={h} className={table.th}>{h}</th>)}
                <th className={table.th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ event, reason, daysAway, sourceName }) => {
                const url = event.source_url ?? event.external_url;
                return (
                  <tr key={event.id} className={table.tr}>
                    <td className={table.td}><RowCheckbox id={event.id} label={event.title} /></td>
                    <td className={`${table.td} max-w-[26rem]`}>
                      <p className="truncate font-medium" title={event.title}>{event.title}</p>
                      <p className="truncate text-xs text-muted">
                        {[event.venue_name, event.address].filter(Boolean).join(", ") || (event.format === "online" ? "Online" : "—")}
                      </p>
                    </td>
                    <td className={`${table.td} whitespace-nowrap text-muted`}>{startsAt(event.starts_at)}</td>
                    <td className={table.td}>
                      <Badge tone={daysAway <= 1 && daysAway >= 0 ? "warning" : "neutral"}>{startsInLabel(daysAway)}</Badge>
                    </td>
                    <td className={`${table.td} max-w-[10rem] truncate text-muted`} title={sourceName}>{sourceName}</td>
                    <td className={table.td}>
                      <Badge tone={reason === "missing" ? "danger" : "info"}>{reason === "missing" ? "Missing" : "Flagged"}</Badge>
                    </td>
                    <td className={`${table.td} w-px whitespace-nowrap`}>
                      <div className="flex items-center justify-end gap-1.5">
                        {url && (
                          <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${event.title} on its source`} className="rounded-full p-2 text-muted transition-colors hover:bg-ink/[0.06] hover:text-fg">
                            <IconExternal size={15} />
                          </a>
                        )}
                        <ActionButton action={resolveReview} fields={{ id: event.id, decision: "reviewed" }} pendingText="…">
                          Mark reviewed
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ReviewSelection>
      <Pagination page={page} pageCount={Math.ceil(total / MISSING_PAGE)} hrefFor={pageHref} total={total} noun="event" />
    </>
  );
}

// ─── Possible duplicates ───────────────────────────────────────────────────

async function DuplicatesTab({ page }: { page: number }) {
  const [{ items, total }, { label }] = await Promise.all([listDuplicateReview({ page, pageSize: DUPLICATES_PAGE }), sourceLabels()]);
  if (total === 0) {
    return <Empty title="No possible duplicates">Pairs with a close start and a similar title show up here. Exact matches are hidden automatically.</Empty>;
  }
  return (
    <>
      <TabIntro>
        Each pair has a close start time and a similar title. The flagged one is hidden until you decide: list both, or keep
        it hidden.
      </TabIntro>
      <ul className="space-y-4">
        {items.map((item) => (
          <li key={item.event.id}><ReviewCard item={item} label={label} resolve={resolveReview} /></li>
        ))}
      </ul>
      <Pagination
        page={page} pageCount={Math.ceil(total / DUPLICATES_PAGE)} total={total} noun="pair"
        hrefFor={(p) => hrefWith(PATH, { tab: "duplicates", page: p > 1 ? p : null })}
      />
    </>
  );
}

// ─── Hidden duplicates ─────────────────────────────────────────────────────

async function HiddenTab() {
  const [hidden, { label }] = await Promise.all([listHiddenDuplicates({ limit: 200 }), sourceLabels()]);
  if (hidden.length === 0) {
    return <Empty title="No hidden duplicates">Duplicates you choose to keep hidden are listed here, so you can bring one back.</Empty>;
  }
  return (
    <>
      <TabIntro>Duplicates you kept hidden. &ldquo;Not a duplicate&rdquo; lists the event again and stops the pair being flagged.</TabIntro>
      <div className={table.wrap}>
        <table className={`${table.table} min-w-[50rem]`}>
          <thead>
            <tr>
              {["Hidden event", "Kept instead", "Starts"].map((h) => <th key={h} className={table.th}>{h}</th>)}
              <th className={table.th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {hidden.map(({ event, original }) => (
              <tr key={event.id} className={table.tr}>
                <td className={`${table.td} max-w-[20rem]`}>
                  <p className="truncate font-medium" title={event.title}>{event.title}</p>
                  <p className="truncate text-xs text-muted">{label(event.source)}</p>
                </td>
                <td className={`${table.td} max-w-[20rem]`}>
                  {original ? (
                    <>
                      <p className="truncate" title={original.title}>{original.title}</p>
                      <p className="truncate text-xs text-muted">{label(original.source)}</p>
                    </>
                  ) : (
                    <span className="text-muted">No longer available</span>
                  )}
                </td>
                <td className={`${table.td} whitespace-nowrap text-muted`}>{startsAt(event.starts_at)}</td>
                <td className={`${table.td} w-px whitespace-nowrap`}>
                  <ActionButton
                    action={resolveReview} fields={{ id: event.id, decision: "not_duplicate" }}
                    confirm={{ title: "Not a duplicate?", body: "Both events will be listed, and this pair won't be flagged again.", confirmLabel: "Not a duplicate" }}
                  >Not a duplicate</ActionButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Imported events ───────────────────────────────────────────────────────

async function ImportedTab() {
  const imported = await listImportedEvents();
  if (imported.length === 0) {
    return <Empty title="No imported events yet">Upcoming events from Luma, Meetup, Eventbrite and Fatsoma sources show up here.</Empty>;
  }
  const noCover = imported.filter((e) => !e.cover_url).length;
  return (
    <>
      <TabIntro>
        Upcoming Luma, Meetup, Eventbrite and Fatsoma events{noCover ? `, ${noCover} without a cover first` : ""}. Fill in a
        missing cover, description or price here; the nightly refresh never overwrites what you save.
      </TabIntro>
      <ul className="space-y-3">
        {imported.map((e) => (
          <li key={e.id}><ImportedEventRow event={e} action={saveImportedDetails} retry={retryPageDetails} /></li>
        ))}
      </ul>
    </>
  );
}

// ─── Runs ──────────────────────────────────────────────────────────────────

async function RunsTab() {
  const runs = await listRecentRuns({ limit: 30 });
  if (runs.length === 0) return <Empty title="No runs yet">Each refresh, nightly or from &ldquo;Refresh all now&rdquo;, is listed here.</Empty>;
  return (
    <>
      <ul className="space-y-2 lg:hidden">
        {runs.map((r) => (
          <li key={r.id} className="glass rounded-[18px] px-4 py-3.5">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium">{r.source?.name ?? "—"}</p>
              <Badge tone={r.status === "ok" ? "success" : "danger"}>{r.status}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {when(r.started_at)} · {r.trigger}
              {r.errors.length > 0 && ` · ${r.errors.length} issue${r.errors.length === 1 ? "" : "s"}`}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted tabular-nums">
              {r.found} found · {r.inserted} new · {r.updated} updated · {r.unchanged} same
              {r.flagged_missing ? ` · ${r.flagged_missing} flagged` : ""}
            </p>
          </li>
        ))}
      </ul>

      <div className={`${table.wrap} hidden lg:block`}>
        <table className={`${table.table} min-w-[40rem]`}>
          <thead>
            <tr>
              {["Started", "Source", "Trigger", "Status", "Found", "New", "Updated", "Same", "Flagged"].map((h) => <th key={h} className={table.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className={table.tr}>
                <td className={`${table.td} whitespace-nowrap text-muted`}>{when(r.started_at)}</td>
                <td className={table.td}>{r.source?.name ?? "—"}</td>
                <td className={`${table.td} text-muted`}>{r.trigger}</td>
                <td className={table.td}>
                  <Badge tone={r.status === "ok" ? "success" : "danger"}>{r.status}</Badge>
                  {r.errors.length > 0 && (
                    <span className="ml-2 text-xs text-muted" title={r.errors.map((e) => e.message).join("\n")}>
                      {r.errors.length} issue{r.errors.length === 1 ? "" : "s"}
                    </span>
                  )}
                </td>
                <td className={table.td}>{r.found}</td>
                <td className={table.td}>{r.inserted}</td>
                <td className={table.td}>{r.updated}</td>
                <td className={table.td}>{r.unchanged}</td>
                <td className={table.td}>{r.flagged_missing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
