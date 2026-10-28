"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Starts the same full refresh as the nightly cron. The Orbit API runs it in the
 * background (one at a time) and answers 202 `{started}`; the Runs list fills in
 * as each source finishes, so the page re-reads it now and again a little later.
 */
export function RefreshAllButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch("/api/cron/refresh-sources", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { started?: boolean; error?: string; detail?: string } | null;
      if (!response.ok || typeof data?.started !== "boolean") {
        setResult({ ok: false, text: `Refresh failed: ${data?.error ?? data?.detail ?? `HTTP ${response.status}`}` });
        return;
      }
      setResult(data.started
        ? { ok: true, text: "Refresh started. Sources update in the background; see Recent runs in a few minutes." }
        : { ok: false, text: "A refresh is already running." });
      router.refresh();
      setTimeout(() => router.refresh(), 30_000);
    } catch {
      setResult({ ok: false, text: "Refresh failed: couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <Button type="button" variant="secondary" size="md" onClick={run} disabled={busy} aria-busy={busy} className="w-full sm:w-auto">
        {busy ? "Starting…" : "Refresh all now"}
      </Button>
      {result && (
        <p role={result.ok ? "status" : "alert"} className={`max-w-sm text-left text-xs sm:text-right ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
          {result.text}
        </p>
      )}
    </div>
  );
}
