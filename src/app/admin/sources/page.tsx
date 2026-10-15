import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import {
  eventCountsBySource, latestRunBySource, listHiddenDuplicates, listRecentRuns, listReviewQueue, listSources, sourceLabels,
} from "@/lib/sources/queries";
import { ActionButton } from "./_components/ActionButton";
import { ReviewCard } from "./_components/ReviewCard";
import { deleteSource, resolveReview, runSourceNow, setSourceEnabled } from "./actions";

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

export default function SourcesPage() {
  return (
    <>
      <PageHeader
        title="Sources"
        subtitle="Approved calendar feeds, refreshed nightly. Only feeds we have permission to use."
        action={<ButtonLink href="/admin/sources/new" size="sm">Add source</ButtonLink>}
      />
      <Suspense fallback={<ListSkeleton />}>
        <SourcesContent />
      </Suspense>
    </>
  );
}

async function SourcesContent() {
  await connection();
  const sources = await listSources();
  const ids = sources.map((s) => s.id);
  const [latest, counts, runs, queue, hidden, labels] = await Promise.all([
    latestRunBySource(ids), eventCountsBySource(ids), listRecentRuns({ limit: 15 }), listReviewQueue(),
    listHiddenDuplicates(), sourceLabels(),
  ]);

  return (
    <>
      <section aria-labelledby="sources-h" className="space-y-3 px-4">
        <h2 id="sources-h" className="font-display text-base font-semibold">Feeds</h2>
        {sources.length === 0 ? (
          <EmptyState title="No sources yet" action={<ButtonLink href="/admin/sources/new" size="sm">Add the first feed</ButtonLink>}>
            Add an iCal feed the owner has agreed we can use.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Feed</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Last run</th>
                  <th className="px-4 py-3 font-medium">Last result</th>
                  <th className="px-4 py-3 font-medium">Events</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line align-top">
                {sources.map((s) => {
                  const run = latest.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/admin/sources/${s.id}/edit`} className="hover:underline">{s.name}</Link>
                        {!s.permission_confirmed && <div className="mt-1"><Badge tone="warning">No permission recorded</Badge></div>}
                      </td>
                      <td className="px-4 py-3 text-muted"><a href={s.url} className="hover:underline" rel="noreferrer" target="_blank">{host(s.url)}</a></td>
                      <td className="px-4 py-3">{s.enabled ? <Badge tone="success">Enabled</Badge> : <Badge>Disabled</Badge>}</td>
                      <td className="px-4 py-3 text-muted">
                        {when(s.last_run_at)}
                        {s.last_status && <div className="mt-1"><Badge tone={s.last_status === "ok" ? "success" : "danger"}>{s.last_status}</Badge></div>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {run ? `${run.found} found · ${run.inserted} new · ${run.updated} updated · ${run.unchanged} same${run.flagged_missing ? ` · ${run.flagged_missing} flagged` : ""}` : "—"}
                        {s.last_error && <p className="mt-1 max-w-xs break-words text-red-300">{s.last_error}</p>}
                      </td>
                      <td className="px-4 py-3 tabular-nums">{counts.get(s.id) ?? 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-start justify-end gap-2">
                          <ActionButton action={runSourceNow} fields={{ id: s.id }} pendingText="Running…">Run now</ActionButton>
                          {s.enabled ? (
                            <ActionButton
                              action={setSourceEnabled} fields={{ id: s.id, enabled: "false" }} variant="ghost"
                              confirm={{ title: `Disable ${s.name}?`, body: "It won't refresh any more. Its events stay in ORBIT.", confirmLabel: "Disable" }}
                            >Disable</ActionButton>
                          ) : (
                            <ActionButton
                              action={setSourceEnabled} fields={{ id: s.id, enabled: "true" }} variant="ghost"
                              confirm={{ title: `Enable ${s.name}?`, body: "It will be fetched every night. Only enable feeds you have permission to use.", confirmLabel: "Enable" }}
                            >Enable</ActionButton>
                          )}
                          <ActionButton
                            action={deleteSource} fields={{ id: s.id }} variant="danger" pendingText="Deleting…"
                            confirm={{
                              title: `Delete ${s.name}?`,
                              body: "The feed and its run history are removed. Imported events stay in ORBIT unless you tick the box below.",
                              confirmLabel: "Delete source",
                            }}
                            extra={
                              <label className="flex items-start gap-2 text-sm">
                                <input type="checkbox" name="remove_events" className="mt-0.5 h-4 w-4 accent-[var(--color-violet)]" />
                                Also remove its upcoming events from ORBIT
                              </label>
                            }
                          >Delete</ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="review-h" className="mt-10 space-y-3 px-4">
        <h2 id="review-h" className="font-display text-base font-semibold">
          Review queue {queue.length > 0 && <Badge tone="warning" className="ml-1 align-middle">{queue.length}</Badge>}
        </h2>
        {queue.length === 0 ? (
          <EmptyState title="Nothing to review">Possible duplicates and events missing from their feed show up here.</EmptyState>
        ) : (
          <ul className="space-y-4">
            {queue.map((item) => (
              <li key={item.event.id}><ReviewCard item={item} label={labels.label} resolve={resolveReview} /></li>
            ))}
          </ul>
        )}
        {hidden.length > 0 && (
          <details className="rounded-2xl border border-line bg-surface p-4">
            <summary className="cursor-pointer text-sm font-medium">Hidden duplicates ({hidden.length})</summary>
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

      <section aria-labelledby="runs-h" className="mt-10 space-y-3 px-4">
        <h2 id="runs-h" className="font-display text-base font-semibold">Recent runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-muted">No runs yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  {["Started", "Source", "Trigger", "Status", "Found", "New", "Updated", "Same", "Flagged"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5 text-muted">{when(r.started_at)}</td>
                    <td className="px-4 py-2.5">{r.source?.name ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{r.trigger}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.status === "ok" ? "success" : "danger"}>{r.status}</Badge>
                      {r.errors.length > 0 && (
                        <span className="ml-2 text-xs text-muted" title={r.errors.map((e) => e.message).join("\n")}>
                          {r.errors.length} issue{r.errors.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{r.found}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.inserted}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.updated}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.unchanged}</td>
                    <td className="px-4 py-2.5 tabular-nums">{r.flagged_missing}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
