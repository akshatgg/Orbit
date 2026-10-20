"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatRefreshSummary } from "@/lib/sources/refresh-summary";
import type { RefreshSummary } from "@/lib/sources/types";

/** Runs the same full refresh as the nightly cron, then shows what changed. */
export function RefreshAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/cron/refresh-sources", { method: "POST" });
      const data = (await response.json().catch(() => null)) as (Partial<RefreshSummary> & { error?: string }) | null;
      if (!response.ok || !data || !Array.isArray(data.sources)) {
        setResult({ ok: false, text: `Refresh failed: ${data?.error ?? `HTTP ${response.status}`}` });
        return;
      }
      const summary = data as RefreshSummary;
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
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="md" onClick={run} disabled={busy} aria-busy={busy}>
        {busy ? "Refreshing…" : "Refresh all now"}
      </Button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`max-w-sm text-right text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
