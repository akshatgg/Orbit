"use server";

import { z } from "zod";
import { MAX_IMPORT_ROWS, pickColumns, validateCsvRows } from "@/lib/admin/csv";
import { importOptions } from "@/lib/admin/options";
import { adminContext, adminError, revalidateEverywhere } from "@/lib/admin/server";
import { authed } from "@/lib/api/session";

export type ImportReport =
  | { ok: true; inserted: number; updated: number; skipped: number; notes: string[] }
  | { ok: false; error: string };

const rowsSchema = z.array(z.record(z.string(), z.unknown())).min(1, "No rows to import").max(MAX_IMPORT_ROWS, `At most ${MAX_IMPORT_ROWS} rows at a time`);

type ImportResult = { inserted: number; updated: number; skipped: number; errors: { row: number; message: string }[] };

/**
 * Imports CSV rows as published events, upserting on (source = 'csv', source_event_id).
 * Rows are re-validated here — the browser preview is a convenience, not a trust boundary —
 * and sent normalised (UK times as UTC, stable ids), so re-importing a sheet updates its events.
 * The API leaves events an admin removed alone and logs the import.
 */
export async function importEvents(rawRows: unknown): Promise<ImportReport> {
  await adminContext();
  const parsedRows = rowsSchema.safeParse(rawRows);
  if (!parsedRows.success) return { ok: false, error: parsedRows.error.issues[0].message };

  let result: ImportResult;
  let invalid: number;
  let sent: number;
  try {
    const { organisers, categories } = await importOptions();
    const results = validateCsvRows(parsedRows.data.map(pickColumns), {
      organiserSlugs: organisers.map((o) => o.slug),
      categorySlugs: categories.map((c) => c.slug),
    });
    const good = results.flatMap((r) => (r.ok ? [r.data] : []));
    invalid = results.length - good.length;
    sent = good.length;
    if (good.length === 0) {
      return { ok: true, inserted: 0, updated: 0, skipped: invalid, notes: [`${invalid} invalid row${invalid === 1 ? "" : "s"} skipped`] };
    }
    result = await authed.post<ImportResult>("/admin/import/csv", {
      body: { rows: good.map((row) => ({ ...row, tags: row.tags.join(";") })) },
    });
  } catch (error) {
    return { ok: false, error: adminError(error) };
  }

  const notes: string[] = [];
  if (invalid) notes.push(`${invalid} invalid row${invalid === 1 ? "" : "s"} skipped`);
  const failed = result.errors.length;
  const leftAlone = sent - result.inserted - result.updated - failed;
  if (leftAlone > 0) notes.push(`${leftAlone} row${leftAlone === 1 ? " matches an event" : "s match events"} you removed — left alone`);
  for (const e of result.errors.slice(0, 5)) notes.push(`Row ${e.row}: ${e.message}`);
  if (failed > 5) notes.push(`…and ${failed - 5} more row${failed - 5 === 1 ? "" : "s"} failed`);

  revalidateEverywhere();
  return { ok: true, inserted: result.inserted, updated: result.updated, skipped: invalid + result.skipped, notes };
}
