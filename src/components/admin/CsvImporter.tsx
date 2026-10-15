"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { importEvents, type ImportReport } from "@/app/admin/import/actions";
import { CSV_COLUMNS, MAX_IMPORT_ROWS, csvTemplate, pickColumns, summariseRows, validateCsvRows, type RawCsvRow } from "@/lib/admin/csv";
import { Empty, table } from "./primitives";
import { IconDownload, IconUpload } from "./icons";

export function CsvImporter({ organiserSlugs, categorySlugs }: { organiserSlugs: string[]; categorySlugs: string[] }) {
  const [rows, setRows] = useState<RawCsvRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () => (rows ? validateCsvRows(rows, { organiserSlugs, categorySlugs }) : []),
    [rows, organiserSlugs, categorySlugs],
  );
  const summary = summariseRows(results);

  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([csvTemplate()], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "orbit-events-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(file: File | undefined) {
    setReport(null);
    setParseError(null);
    setRows(null);
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.trim(),
      complete: (res) => {
        const headers = (res.meta.fields ?? []).map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, "_"));
        if (!headers.includes("title") || !headers.includes("starts_at")) {
          setParseError("This doesn't look like the template: it needs at least title and starts_at columns.");
          return;
        }
        if (res.data.length === 0) return setParseError("The file has a header but no rows.");
        if (res.data.length > MAX_IMPORT_ROWS) return setParseError(`That's ${res.data.length} rows. Import at most ${MAX_IMPORT_ROWS} at a time.`);
        setRows(res.data.map(pickColumns));
      },
      error: (err) => setParseError(err.message),
    });
  }

  function runImport() {
    if (!rows) return;
    startTransition(async () => {
      try {
        setReport(await importEvents(rows));
      } catch {
        setReport({ ok: false, error: "Couldn't reach the server. Try again." });
      }
    });
  }

  function reset() {
    setRows(null); setReport(null); setParseError(null); setFileName("");
    if (input.current) input.current.value = "";
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-2xl border border-line bg-surface/80 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <h2 className="font-display text-sm font-semibold">1. Get the template</h2>
          <p className="mt-1 text-sm text-muted">
            Columns: <span className="font-mono text-xs">{CSV_COLUMNS.join(", ")}</span>. Times are UK time as{" "}
            <span className="font-mono text-xs">2026-11-12 18:30</span>, or ISO with a zone. Separate tags with <span className="font-mono text-xs">;</span>.
            Re-uploading the same sheet updates events instead of duplicating them.
          </p>
        </div>
        <Button variant="secondary" onClick={downloadTemplate}><IconDownload size={15} /> Download template</Button>
      </div>

      <div className="rounded-2xl border border-line bg-surface/80 p-5">
        <h2 className="font-display text-sm font-semibold">2. Upload your CSV</h2>
        <label
          htmlFor="csv-file"
          className="mt-3 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted transition-colors hover:border-violet hover:bg-surface-2"
        >
          <IconUpload size={22} />
          <span>{fileName ? <span className="text-fg">{fileName}</span> : "Choose a .csv file"}</span>
          <input id="csv-file" ref={input} type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        {parseError && <p role="alert" className="mt-3 text-sm text-red-300">{parseError}</p>}
      </div>

      {rows && !report && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold">3. Preview</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="success">{summary.valid} valid</Badge>
              {summary.invalid > 0 && <Badge tone="danger">{summary.invalid} with errors (will be skipped)</Badge>}
              <Button variant="ghost" size="md" onClick={reset} disabled={pending}>Start over</Button>
              <Button size="md" onClick={runImport} disabled={pending || summary.valid === 0} aria-busy={pending}>
                {pending ? "Importing…" : `Import ${summary.valid} valid row${summary.valid === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Row</th>
                  <th className={table.th}>Title</th>
                  <th className={table.th}>Starts (UK)</th>
                  <th className={table.th}>Format</th>
                  <th className={table.th}>Result</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.line} className={table.tr}>
                    <td className={`${table.td} tabular-nums text-muted`}>{r.line}</td>
                    <td className={`${table.td} max-w-72`}><span className="line-clamp-1">{r.ok ? r.data.title : r.raw.title || "—"}</span></td>
                    <td className={`${table.td} whitespace-nowrap text-muted`}>
                      {r.ok
                        ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(r.data.starts_at))
                        : r.raw.starts_at || "—"}
                    </td>
                    <td className={`${table.td} text-muted`}>{r.ok ? r.data.format.replace("_", " ") : r.raw.format || "—"}</td>
                    <td className={table.td}>
                      {r.ok ? (
                        <Badge tone="success">OK</Badge>
                      ) : (
                        <ul className="space-y-0.5 text-xs text-red-300">{r.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report && (
        <div role="status" className="rounded-2xl border border-line bg-surface/80 p-5">
          {report.ok ? (
            <>
              <h2 className="font-display text-lg font-semibold">Import finished</h2>
              <dl className="mt-3 grid max-w-md grid-cols-3 gap-3 text-center">
                {([["Inserted", report.inserted], ["Updated", report.updated], ["Skipped", report.skipped]] as const).map(([l, n]) => (
                  <div key={l} className="rounded-xl border border-line p-3">
                    <dd className="font-display text-2xl font-semibold tabular-nums">{n}</dd>
                    <dt className="text-xs text-muted">{l}</dt>
                  </div>
                ))}
              </dl>
              {report.notes.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-muted">{report.notes.map((n) => <li key={n}>{n}</li>)}</ul>}
              <div className="mt-4 flex gap-2">
                <Button variant="secondary" onClick={reset}>Import another file</Button>
                <a href="/admin/events?source=csv&when=all" className="inline-flex h-10 items-center rounded-xl px-4 text-sm text-muted hover:text-fg">View imported events</a>
              </div>
            </>
          ) : (
            <>
              <p role="alert" className="text-sm text-red-300">{report.error}</p>
              <Button className="mt-3" variant="secondary" onClick={() => setReport(null)}>Back to preview</Button>
            </>
          )}
        </div>
      )}

      {!rows && !report && !parseError && <Empty title="Nothing uploaded yet">Rows are checked in your browser first. Nothing is saved until you click import.</Empty>}
    </div>
  );
}
