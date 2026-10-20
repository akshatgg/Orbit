import { Suspense } from "react";
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
import type { SourceRun } from "@/lib/sources/types";
import { ActionButton } from "./_components/ActionButton";
import { ImportedEventRow } from "./_components/ImportedEventRow";
import { RefreshAllButton } from "./_components/RefreshAllButton";
import { ReviewCard } from "./_components/ReviewCard";
import { deleteSource, resolveReview, retryPageDetails, runSourceNow, saveImportedDetails, setSourceEnabled } from "./actions";

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

/** The three per-feed actions. Cards get a full-width two-column grid; the desktop table keeps them inline. */
function SourceActions({ source, full = false, className = "" }: { source: SourceWithDefaults; full?: boolean; className?: string }) {
  const size = full ? "md" : "sm";
  return (
    <div className={`${full ? "grid grid-cols-2 gap-2" : "flex flex-wrap items-start justify-end gap-2"} ${className}`}>
      <ActionButton action={runSourceNow} fields={{ id: source.id }} pendingText="Running…" full={full} size={size}>Run now</ActionButton>
      {source.enabled ? (
        <ActionButton
          action={setSourceEnabled} fields={{ id: source.id, enabled: "false" }} variant="ghost" full={full} size={size}
          confirm={{ title: `Disable ${source.name}?`, body: "It won't refresh any more. Its events stay in ORBIT.", confirmLabel: "Disable" }}
        >Disable</ActionButton>
      ) : (
        <ActionButton
          action={setSourceEnabled} fields={{ id: source.id, enabled: "true" }} variant="ghost" full={full} size={size}
          confirm={{ title: `Enable ${source.name}?`, body: "It will be fetched every night. Only enable feeds you have permission to use.", confirmLabel: "Enable" }}
        >Enable</ActionButton>
      )}
      <ActionButton
        action={deleteSource} fields={{ id: source.id }} variant="danger" pendingText="Deleting…" full={full} size={size}
        className={full ? "col-span-2" : ""}
        confirm={{
          title: `Delete ${source.name}?`,
          body: "The feed and its run history are removed. Imported events stay in ORBIT unless you tick the box below.",
          confirmLabel: "Delete source",
        }}
        extra={
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="remove_events" className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]" />
            Also remove its upcoming events from ORBIT
          </label>
        }
      >Delete</ActionButton>
    </div>
  );
}

function FeedCard({ source, run, eventCount }: { source: SourceWithDefaults; run: SourceRun | undefined; eventCount: number }) {
  return (
    <article className="glass rounded-[20px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/admin/sources/${source.id}/edit`} className="block truncate text-[15px] font-medium transition-colors hover:text-accent">
            {source.name}
          </Link>
          <a href={source.url} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-xs text-muted transition-colors hover:text-fg">
            {host(source.url)}
          </a>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={source.enabled ? "success" : "neutral"}>{source.enabled ? "Enabled" : "Disabled"}</Badge>
          {source.last_status && <Badge tone={source.last_status === "ok" ? "success" : "danger"}>{source.last_status}</Badge>}
        </div>
      </div>

      {!source.permission_confirmed && <div className="mt-3"><Badge tone="warning">No permission recorded</Badge></div>}

      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-ink/[0.035] p-3.5 text-xs">
        <div>
          <dt className="text-subtle">Last run</dt>
          <dd className="mt-0.5 text-muted">{when(source.last_run_at)}</dd>
        </div>
        <div>
          <dt className="text-subtle">Events</dt>
          <dd className="mt-0.5 tabular-nums">{eventCount}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-subtle">Last result</dt>
          <dd className="mt-0.5 leading-relaxed text-muted">{runSummary(run)}</dd>
        </div>
      </dl>

      {source.last_error && (
        <p className="mt-3 break-words rounded-xl bg-red-500/5 px-3 py-2 text-xs text-red-300">{source.last_error}</p>
      )}

      <SourceActions source={source} full className="mt-4" />
    </article>
  );
}

export default function SourcesPage() {
  return (
    <>
      <AdminHeader
        eyebrow="Events"
        title="Sources"
        subtitle="Approved calendar feeds, refreshed nightly. Only feeds we have permission to use."
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

  return (
    <>
      <section aria-labelledby="sources-h" className="space-y-4">
        <h2 id="sources-h" className="text-base font-semibold tracking-tight">Feeds</h2>
        {sources.length === 0 ? (
          <Empty title="No sources yet" action={<ButtonLink href="/admin/sources/new" size="sm">Add the first feed</ButtonLink>}>
            Add an iCal feed the owner has agreed we can use.
          </Empty>
        ) : (
          <>
            {/* Phones and tablets: cards, so nothing is squeezed into a horizontally scrolling table. */}
            <ul className="space-y-3 xl:hidden">
              {sources.map((s) => (
                <li key={s.id}>
                  <FeedCard source={s} run={latest.get(s.id)} eventCount={counts.get(s.id) ?? 0} />
                </li>
              ))}
            </ul>

            {/* Desktop: the full table. */}
            <div className={`${table.wrap} hidden xl:block`}>
              <table className={`${table.table} min-w-[56rem]`}>
                <thead>
                  <tr>
                    <th className={table.th}>Name</th>
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
                        <td className={`${table.td} text-muted`}><a href={s.url} className="transition-colors hover:text-fg" rel="noreferrer" target="_blank">{host(s.url)}</a></td>
                        <td className={table.td}>{s.enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>}</td>
                        <td className={`${table.td} text-muted`}>
                          {when(s.last_run_at)}
                          {s.last_status && <div className="mt-1"><Badge tone={s.last_status === "ok" ? "success" : "danger"}>{s.last_status}</Badge></div>}
                        </td>
                        <td className={`${table.td} text-xs text-muted`}>
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
        <section aria-labelledby="imported-h" className="mt-10 space-y-4">
          <h2 id="imported-h" className="text-base font-semibold tracking-tight">
            Imported events{" "}
            {imported.some((e) => !e.cover_url) && (
              <Badge tone="warning" className="ml-1 align-middle">{imported.filter((e) => !e.cover_url).length} without cover</Badge>
            )}
          </h2>
          <p className="text-sm text-muted">
            Upcoming Luma and Meetup events. Luma covers, descriptions and prices are read automatically; Meetup locations come
            from its event page, and Meetup descriptions from its feed. Add anything missing here. The nightly refresh never
            overwrites a cover, price or Luma description you save.
          </p>
          <ul className="space-y-3">
            {imported.map((e) => (
              <li key={e.id}><ImportedEventRow event={e} action={saveImportedDetails} retry={retryPageDetails} /></li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="review-h" className="mt-10 space-y-4">
        <h2 id="review-h" className="text-base font-semibold tracking-tight">
          Review queue {queue.length > 0 && <Badge tone="warning" className="ml-1 align-middle">{queue.length}</Badge>}
        </h2>
        {queue.length === 0 ? (
          <Empty title="Nothing to review">Possible duplicates and events missing from their feed show up here.</Empty>
        ) : (
          <ul className="space-y-4">
            {queue.map((item) => (
              <li key={item.event.id}><ReviewCard item={item} label={labels.label} resolve={resolveReview} /></li>
            ))}
          </ul>
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

      <section aria-labelledby="runs-h" className="mt-10 space-y-4">
        <h2 id="runs-h" className="text-base font-semibold tracking-tight">Recent runs</h2>
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
      </section>
    </>
  );
}
