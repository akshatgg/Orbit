"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatRefreshSummary } from "@/lib/sources/refresh-summary";
import type { RefreshSummary, RunError, RunSummary } from "@/lib/sources/types";

/** The Orbit API's refresh summary (snake_case), or `{started}` when it runs in the background. */
type ApiRun = {
  source_id: string; name: string; status: RunSummary["status"]; found: number; inserted: number; updated: number;
  unchanged: number; flagged_missing: number; enriched: number; classified?: number; errors: RunError[];
};
type ApiRefresh = {
  ok: boolean; started_at: string; finished_at: string; sources: ApiRun[]; expired: number;
  duplicates_flagged: number; errors: string[];
};
type ApiResponse = (Partial<ApiRefresh> & { started?: boolean; error?: string; detail?: string }) | null;

function toSummary(data: ApiRefresh): RefreshSummary {
  return {
    ok: data.ok,
    startedAt: data.started_at,
    finishedAt: data.finished_at,
    expired: data.expired,
    duplicatesFlagged: data.duplicates_flagged,
    errors: data.errors,
    sources: data.sources.map((s) => ({
      sourceId: s.source_id, name: s.name, status: s.status, found: s.found, inserted: s.inserted, updated: s.updated,
      unchanged: s.unchanged, flaggedMissing: s.flagged_missing, enriched: s.enriched, classified: s.classified, errors: s.errors,
    })),
  };
}

/** Runs the same full refresh as the nightly cron, then shows what changed. */
export function RefreshAllButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/cron/refresh-sources", { method: "POST" });
      const data = (await response.json().catch(() => null)) as ApiResponse;
      if (response.ok && typeof data?.started === "boolean") {
        // The API refreshes in the background: the Runs tab fills in as each source finishes.
        setResult(data.started
          ? { ok: true, text: "Refresh started. Sources update in the background; see Runs in a few minutes." }
          : { ok: false, text: "A refresh is already running." });
        return;
      }
      if (!response.ok || !data || !Array.isArray(data.sources)) {
        setResult({ ok: false, text: `Refresh failed: ${data?.error ?? data?.detail ?? `HTTP ${response.status}`}` });
        return;
      }
      const summary = toSummary(data as ApiRefresh);
      const issues = summary.errors.length + summary.sources.reduce((n, s) => n + s.errors.length, 0);
      setResult({
        ok: summary.ok,
        text: `${formatRefreshSummary(summary)}${issues ? ` · ${issues} issue${issues === 1 ? "" : "s"} (see Recent runs)` : ""}`,
      });
      router.refresh();
    } catch {
      setResult({ ok: false, text: "Refresh failed: couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Button type="button" variant="secondary" size="md" onClick={run} disabled={busy} aria-busy={busy} className="w-full sm:w-auto">
        {busy ? "Refreshing…" : "Refresh all now"}
      </Button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`max-w-sm text-left text-xs sm:text-right ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
