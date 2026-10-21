import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { AdminHeader, Empty, TableSkeleton, table } from "@/components/admin/primitives";
import { IconPlus } from "@/components/admin/icons";
import {
  eventCountsBySource, latestRunBySource, listHiddenDuplicates, listImportedEvents, listRecentRuns, listReviewQueue, listSources, sourceLabels,
  type SourceWithDefaults,
} from "@/lib/sources/queries";
import { SOURCE_KIND_LABELS, type SourceRun } from "@/lib/sources/types";
import { ActionButton } from "./_components/ActionButton";
import { ImportedEventRow } from "./_components/ImportedEventRow";
import { RefreshAllButton } from "./_components/RefreshAllButton";
import { ReviewCard } from "./_components/ReviewCard";
import { resolveReview, retryPageDetails, runSourceNow, saveImportedDetails, setSourceEnabled } from "./actions";
import { deleteSource } from "./delete-source";

export const metadata = { title: "Event sources · ORBIT admin" };

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never";

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

/** Per-feed actions. Kept compact so a card never turns into a wall of full-width buttons. */
function SourceActions({ source, align = "end", className = "" }: {
  source: SourceWithDefaults; align?: "start" | "end"; className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${align === "end" ? "justify-end" : "justify-start"} ${className}`}>
      <ButtonLink href={`/admin/sources/${source.id}/edit`} variant="secondary" size="sm">Edit</ButtonLink>
      <ActionButton action={runSourceNow} fields={{ id: source.id }} pendingText="Running…" size="sm">Run now</ActionButton>
      {source.enabled ? (
        <ActionButton
          action={setSourceEnabled} fields={{ id: source.id, enabled: "false" }} variant="ghost" size="sm"
          confirm={{ title: `Disable ${source.name}?`, body: "It won't refresh any more. Its events stay in ORBIT.", confirmLabel: "Disable" }}
        >Disable</ActionButton>
      ) : (
        <ActionButton
          action={setSourceEnabled} fields={{ id: source.id, enabled: "true" }} variant="ghost" size="sm"
          confirm={{ title: `Enable ${source.name}?`, body: "It will be fetched every night. Only enable feeds you have permission to use.", confirmLabel: "Enable" }}
        >Enable</ActionButton>
      )}
      <ActionButton
        action={deleteSource} fields={{ id: source.id }} variant="danger" pendingText="Deleting…" size="sm"
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
      >Delete</ActionButton>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "warning" | "danger" }) {
  return (
    <div className="glass rounded-[18px] p-4">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-xl font-semibold tracking-tight tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-0.5 text-[11px] ${tone === "danger" ? "text-red-300" : tone === "warning" ? "text-orange" : "text-subtle"}`}>
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionHeading({ id, title, count, hint, action, tone = "neutral" }: {
  id: string; title: string; count?: number; hint?: string; action?: ReactNode; tone?: "neutral" | "warning";
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 id={id} className="flex items-center gap-2 text-base font-semibold tracking-tight">
          {title}
          {count !== undefined && <Badge tone={count > 0 ? tone : "neutral"}>{count}</Badge>}
        </h2>
        {hint && <p className="mt-0.5 max-w-2xl text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

function FeedCard({ source, run, eventCount }: { source: SourceWithDefaults; run: SourceRun | undefined; eventCount: number }) {
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
          <dd className="mt-0.5 tabular-nums">{eventCount}</dd>
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

export default function SourcesPage() {
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
        <SourcesContent />
      </Suspense>
    </>
  );
}

async function SourcesContent() {
  await connection();
  const sources = await listSources();
  const ids = sources.map((s) => s.id);
  const [latest, counts, runs, queue, hidden, labels, imported] = await Promise.all([
    latestRunBySource(ids), eventCountsBySource(ids), listRecentRuns({ limit: 15 }), listReviewQueue(),
    listHiddenDuplicates(), sourceLabels(), listImportedEvents(),
  ]);

  const enabledCount = sources.filter((source) => source.enabled).length;
  const totalEvents = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const lastRefresh = sources
    .map((source) => source.last_run_at)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) ?? null;
  const errorCount = sources.filter((source) => source.last_status === "error").length;

  return (
    <>
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Sources" value={`${enabledCount}/${sources.length}`} hint={`${enabledCount} enabled`} />
        <Stat label="Imported events" value={totalEvents} hint="across all sources" />
        <Stat
          label="Needs review"
          value={queue.length}
          hint={queue.length ? "waiting for an admin" : "nothing waiting"}
          tone={queue.length ? "warning" : undefined}
        />
        <Stat
          label="Last refresh"
          value={lastRefresh ? when(lastRefresh) : "Never"}
          hint={errorCount ? `${errorCount} source error${errorCount === 1 ? "" : "s"}` : "all sources healthy"}
          tone={errorCount ? "danger" : undefined}
        />
      </div>

      <section aria-labelledby="sources-h" className="space-y-4">
        <SectionHeading
          id="sources-h"
          title="Feeds"
          count={sources.length}
          hint="Calendar feeds and discovery links, refreshed nightly."
        />
        {sources.length === 0 ? (
          <Empty title="No sources yet" action={<ButtonLink href="/admin/sources/new" size="sm">Add the first source</ButtonLink>}>
            Add an iCal feed, a Luma link or a Meetup link the owner has agreed we can use.
          </Empty>
        ) : (
          <>
            {/* Up to 2xl: cards. The table is only used when there is room for every column. */}
            <ul className="grid gap-3 lg:grid-cols-2 2xl:hidden">
              {sources.map((s) => (
                <li key={s.id}>
                  <FeedCard source={s} run={latest.get(s.id)} eventCount={counts.get(s.id) ?? 0} />
                </li>
              ))}
            </ul>

            {/* Very wide screens: the full table. */}
            <div className={`${table.wrap} hidden 2xl:block`}>
              <table className={`${table.table} min-w-[62rem]`}>
                <thead>
                  <tr>
                    <th className={table.th}>Name</th>
                    <th className={table.th}>Type</th>
                    <th className={table.th}>Feed</th>
                    <th className={table.th}>State</th>
                    <th className={table.th}>Last run</th>
                    <th className={table.th}>Last result</th>
                    <th className={table.th}>Events</th>
                    <th className={table.th}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="align-top">
                  {sources.map((s) => {
                    const run = latest.get(s.id);
                    return (
                      <tr key={s.id} className={table.tr}>
                        <td className={`${table.td} font-medium`}>
                          <Link href={`/admin/sources/${s.id}/edit`} className="transition-colors hover:text-accent">{s.name}</Link>
                          {!s.permission_confirmed && <div className="mt-1"><Badge tone="warning">No permission recorded</Badge></div>}
                        </td>
                        <td className={table.td}><Badge tone="brand">{SOURCE_KIND_LABELS[s.kind]}</Badge></td>
                        <td className={`${table.td} text-muted`}><a href={s.url} className="transition-colors hover:text-fg" rel="noreferrer" target="_blank" title={s.url}>{host(s.url)}</a></td>
                        <td className={table.td}>{s.enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>}</td>
                        <td className={`${table.td} text-muted`}>
                          {when(s.last_run_at)}
                          {s.last_status && <div className="mt-1"><Badge tone={s.last_status === "ok" ? "success" : "danger"}>{s.last_status}</Badge></div>}
                        </td>
                        <td className={`${table.td} max-w-[18rem] text-xs text-muted`}>
                          {runSummary(run)}
                          {s.last_error && <p className="mt-1 max-w-xs break-words text-red-300">{s.last_error}</p>}
                        </td>
                        <td className={table.td}>{counts.get(s.id) ?? 0}</td>
                        <td className={table.td}>
                          <SourceActions source={s} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {imported.length > 0 && (
        <details className="mt-8">
          <summary className="glass flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-[20px] px-4 py-3.5 [&::-webkit-details-marker]:hidden sm:px-5">
            <div>
              <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
                Imported events <Badge>{imported.length}</Badge>
              </span>
              <span className="mt-0.5 block max-w-3xl text-xs text-muted">
                Luma and Meetup events. Fill in a missing cover, description, venue or price here; the nightly refresh never
                overwrites what you save.
              </span>
            </div>
            <span className="flex items-center gap-2">
              {imported.some((e) => !e.cover_url) && (
                <Badge tone="warning">{imported.filter((e) => !e.cover_url).length} without cover</Badge>
              )}
              <span className="text-xs text-muted">Open</span>
            </span>
          </summary>
          <ul className="mt-3 space-y-3">
            {imported.map((e) => (
              <li key={e.id}><ImportedEventRow event={e} action={saveImportedDetails} retry={retryPageDetails} /></li>
            ))}
          </ul>
        </details>
      )}

      <section aria-labelledby="review-h" className="mt-8 space-y-4">
        <SectionHeading
          id="review-h"
          title="Review queue"
          count={queue.length}
          tone="warning"
          hint="Possible duplicates and events missing from their feed. Exact URL or event-id matches are hidden automatically."
        />
        {queue.length === 0 ? (
          <Empty title="Nothing to review">Possible duplicates and events missing from their feed show up here.</Empty>
        ) : (
          <>
            <ul className="space-y-4">
              {queue.slice(0, 3).map((item) => (
                <li key={item.event.id}><ReviewCard item={item} label={labels.label} resolve={resolveReview} /></li>
              ))}
            </ul>
            {queue.length > 3 && (
              <details className="glass rounded-[20px] p-4">
                <summary className="cursor-pointer text-sm font-medium text-muted transition-colors hover:text-fg">
                  Show {queue.length - 3} more
                </summary>
                <ul className="mt-4 space-y-4">
                  {queue.slice(3).map((item) => (
                    <li key={item.event.id}><ReviewCard item={item} label={labels.label} resolve={resolveReview} /></li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
        {hidden.length > 0 && (
          <details className="glass rounded-[20px] p-5">
            <summary className="cursor-pointer text-sm font-medium text-muted transition-colors hover:text-fg">Hidden duplicates ({hidden.length})</summary>
            <ul className="mt-3 space-y-3">
              {hidden.map(({ event, original }) => (
                <li key={event.id}>
                  <ReviewCard item={{ event, original, reason: "duplicate" }} label={labels.label} resolve={resolveReview} resolved />
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <details className="mt-8">
        <summary className="glass flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 rounded-[20px] px-4 py-3.5 [&::-webkit-details-marker]:hidden sm:px-5">
          <div>
            <span className="flex items-center gap-2 text-base font-semibold tracking-tight">
              Recent runs <Badge>{runs.length}</Badge>
            </span>
            <span className="mt-0.5 block text-xs text-muted">Every refresh, newest first.</span>
          </div>
          <span className="text-xs text-muted">Open</span>
        </summary>
        <div className="mt-3 space-y-4">
        {runs.length === 0 ? (
          <p className="text-sm text-muted">No runs yet.</p>
        ) : (
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
                    {["Started", "Source", "Trigger", "Status", "Found", "New", "Updated", "Same", "Flagged"].map((h) => (
                      <th key={h} className={table.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className={table.tr}>
                      <td className={`${table.td} text-muted`}>{when(r.started_at)}</td>
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
        )}
        </div>
      </details>
    </>
  );
}
