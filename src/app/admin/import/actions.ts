"use server";

import { z } from "zod";
import { MAX_IMPORT_ROWS, pickColumns, validateCsvRows } from "@/lib/admin/csv";
import { adminContext, friendlyDbError, logAdminAction, revalidateEverywhere } from "@/lib/admin/server";

export type ImportReport =
  | { ok: true; inserted: number; updated: number; skipped: number; notes: string[] }
  | { ok: false; error: string };

const rowsSchema = z.array(z.record(z.string(), z.unknown())).min(1, "No rows to import").max(MAX_IMPORT_ROWS, `At most ${MAX_IMPORT_ROWS} rows at a time`);

/**
 * Imports CSV rows as published events, upserting on (source = 'csv', source_event_id).
 * Rows are re-validated here — the browser preview is a convenience, not a trust boundary.
 */
export async function importEvents(rawRows: unknown): Promise<ImportReport> {
  const { supabase } = await adminContext();
  const parsedRows = rowsSchema.safeParse(rawRows);
  if (!parsedRows.success) return { ok: false, error: parsedRows.error.issues[0].message };

  const [{ data: orgs }, { data: cats }] = await Promise.all([
    supabase.from("organisers").select("id, slug"),
    supabase.from("categories").select("id, slug"),
  ]);
  const orgIds = new Map((orgs ?? []).map((o) => [o.slug as string, o.id as string]));
  const catIds = new Map((cats ?? []).map((c) => [c.slug as string, c.id as string]));

  const results = validateCsvRows(parsedRows.data.map(pickColumns), { organiserSlugs: orgIds.keys(), categorySlugs: catIds.keys() });
  const good = results.flatMap((r) => (r.ok ? [r.data] : []));
  const notes: string[] = [];
  let skipped = results.length - good.length;
  if (skipped) notes.push(`${skipped} invalid row${skipped === 1 ? "" : "s"} skipped`);
  if (good.length === 0) return { ok: true, inserted: 0, updated: 0, skipped, notes };

  // Which of these already exist? Events an admin removed stay removed.
  const existing = new Map<string, string>();
  const ids = good.map((g) => g.source_event_id);
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("events").select("source_event_id, status").eq("source", "csv").in("source_event_id", ids.slice(i, i + 100));
    if (error) return { ok: false, error: friendlyDbError(error) };
    for (const e of data ?? []) existing.set(e.source_event_id as string, e.status as string);
  }

  const toWrite = good.filter((g) => existing.get(g.source_event_id) !== "removed");
  const removed = good.length - toWrite.length;
  if (removed) {
    skipped += removed;
    notes.push(`${removed} row${removed === 1 ? " matches an event" : "s match events"} you removed — left alone`);
  }

  const now = new Date().toISOString();
  const payload = toWrite.map(({ organiser_slug, category_slug, ...e }) => ({
    ...e,
    organiser_id: organiser_slug ? orgIds.get(organiser_slug) ?? null : null,
    category_id: category_slug ? catIds.get(category_slug) ?? null : null,
    source: "csv",
    status: "published",
    currency: "GBP",
    needs_review: false,
    last_verified_at: now,
  }));

  let inserted = 0;
  let updated = 0;
  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { error } = await supabase.from("events").upsert(chunk, { onConflict: "source,source_event_id" });
    if (error) {
      notes.push(`Stopped after ${inserted + updated} rows: ${friendlyDbError(error)}`);
      skipped += payload.length - i;
      break;
    }
    for (const row of chunk) {
      if (existing.has(row.source_event_id)) updated++;
      else inserted++;
    }
  }

  await logAdminAction(supabase, "import.csv", "import", null, { inserted, updated, skipped });
  revalidateEverywhere();
  return { ok: true, inserted, updated, skipped, notes };
}
