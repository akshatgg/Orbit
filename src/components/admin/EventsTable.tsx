"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { deleteEvents, removeEvents, setEventsCategory } from "@/app/admin/events/actions";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EVENT_STATUS, sourceLabel, type Tone } from "@/lib/admin/labels";
import type { EventStatus, RegistrationMode } from "@/types/database";
import { ConfirmDialog } from "./ConfirmDialog";
import { EventMenu } from "./EventActions";
import { IconEyeOff, IconStar, IconFlag, IconTrash } from "./icons";
import { table } from "./primitives";
import { toast } from "./Toaster";

/** One row of the admin events table — plain data so it can cross the server/client boundary. */
export type EventTableRow = {
  id: string;
  title: string;
  category: string | null;
  featured: boolean;
  needsReview: boolean;
  /** Pre-formatted in UK time on the server, so the client never disagrees about timezones. */
  when: string;
  organiser: { name: string; verified: boolean; status: string } | null;
  source: string;
  status: EventStatus;
  cancelReason: string | null;
  registrationMode: RegistrationMode;
  going: number;
  pending: number;
  organiserId: string | null;
  sourceUrl: string | null;
  /** Dates of one recurring series share it; the table shows them as one block. */
  seriesKey: string | null;
  seriesLabel: string | null;
  /** "Mon" — UK time, like `when`. */
  weekday: string;
};

type Block = { kind: "event"; row: EventTableRow } | { kind: "series"; key: string; rows: EventTableRow[] };

/** Rows in order, with every series on the page folded into one block where its first date sits. */
function toBlocks(rows: EventTableRow[]): Block[] {
  const bySeries = new Map<string, EventTableRow[]>();
  for (const r of rows) if (r.seriesKey) bySeries.set(r.seriesKey, [...(bySeries.get(r.seriesKey) ?? []), r]);
  const blocks: Block[] = [];
  const placed = new Set<string>();
  for (const r of rows) {
    const dates = r.seriesKey ? bySeries.get(r.seriesKey)! : [];
    if (dates.length < 2) blocks.push({ kind: "event", row: r });
    else if (!placed.has(r.seriesKey!)) {
      placed.add(r.seriesKey!);
      blocks.push({ kind: "series", key: r.seriesKey!, rows: dates });
    }
  }
  return blocks;
}

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Every week on Wednesday" (the source's words, end date dropped) or the weekdays it falls on. */
function repeatSummary(rows: EventTableRow[]) {
  const label = rows[0].seriesLabel?.replace(/\s+until\b.*$/i, "").trim();
  if (label) return label;
  const days = WEEK.filter((d) => rows.some((r) => r.weekday === d));
  return `Every ${days.join(", ")}`;
}

const checkboxClass =
  "size-4 shrink-0 cursor-pointer rounded-[5px] border border-ink/25 bg-ink/[0.06] accent-orange transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Admin events table with multi-select. Tick rows (or the header box) and the selection bar
 * lets you re-categorise or remove them all at once, behind the same confirm + audit trail as the row menu.
 */
export function EventsTable({ rows, categories, sourceNames }: {
  rows: EventTableRow[]; categories: { id: string; name: string }[]; sourceNames: Record<string, string>;
}) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"remove" | "delete" | null>(null);
  const [category, setCategory] = useState("");
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const blocks = useMemo(() => toBlocks(rows), [rows]);
  const [pending, startTransition] = useTransition();
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const someSelected = selected.size > 0 && !allSelected;

  const ids = useMemo(() => rows.map((r) => r.id), [rows]);
  const chosen = useMemo(() => ids.filter((id) => selected.has(id)), [ids, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Ticks or clears every date of a series at once. */
  function toggleMany(seriesIds: string[]) {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = seriesIds.every((id) => next.has(id));
      for (const id of seriesIds) {
        if (all) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  function toggleOpen(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(ids));
  }

  function remove(reason: string) {
    setError(null);
    startTransition(async () => {
      let result;
      try {
        result = await removeEvents(chosen, reason);
      } catch {
        result = { ok: false as const, error: "Couldn't reach the server. Try again." };
      }
      if (result.ok) {
        setConfirm(null);
        setSelected(new Set());
        toast(result.message ?? "Events removed");
      } else {
        setError(result.error);
      }
    });
  }

  function hardDelete() {
    setError(null);
    startTransition(async () => {
      let result;
      try {
        result = await deleteEvents(chosen);
      } catch {
        result = { ok: false as const, error: "Couldn't reach the server. Try again." };
      }
      if (result.ok) {
        setConfirm(null);
        setSelected(new Set());
        toast(result.message ?? "Events deleted");
      } else {
        setError(result.error);
      }
    });
  }

  function applyCategory() {
    if (!category) return;
    const target = category === "__none" ? null : category;
    startTransition(async () => {
      let result;
      try {
        result = await setEventsCategory(chosen, target);
      } catch {
        result = { ok: false as const, error: "Couldn't reach the server. Try again." };
      }
      if (result.ok) {
        setSelected(new Set());
        setCategory("");
        toast(result.message ?? "Category updated");
      } else {
        toast(result.error, "error");
      }
    });
  }


  function renderRow(e: EventTableRow, nested: boolean) {
              const st: { label: string; tone: Tone } = EVENT_STATUS[e.status];
              const checked = selected.has(e.id);
              return (
                <tr
                  key={e.id}
                  className={`${table.tr} ${checked ? "bg-accent/[0.06]" : ""} ${e.status === "removed" ? "opacity-60" : ""} ${nested ? "bg-ink/[0.02]" : ""}`}
                >
                  <td className={`${table.td} w-10 pr-0`}>
                    <input
                      type="checkbox"
                      className={checkboxClass}
                      checked={checked}
                      onChange={() => toggle(e.id)}
                      aria-label={`Select ${e.title}`}
                    />
                  </td>
                  <td className={`${table.td} min-w-52 max-w-80 ${nested ? "pl-8" : ""}`}>
                    <Link href={`/events/${e.id}`} target="_blank" className="line-clamp-1 font-medium transition-colors hover:text-accent">{e.title}</Link>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
                      {e.category ?? "No category"}
                      {e.featured && <Badge tone="brand"><IconStar size={11} /> Featured</Badge>}
                      {e.needsReview && <Badge tone="warning"><IconFlag size={11} /> Needs review</Badge>}
                    </span>
                  </td>
                  <td className={`${table.td} whitespace-nowrap text-muted tabular-nums`}>{e.when}</td>
                  <td className={table.td}>
                    {e.organiser ? (
                      <span className="flex items-center gap-1.5">
                        <span className="line-clamp-1">{e.organiser.name}</span>
                        {e.organiser.verified && <VerifiedMark />}
                        {e.organiser.status !== "approved" && <Badge tone="warning">{e.organiser.status}</Badge>}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={`${table.td} text-muted`}>{sourceLabel(e.source, sourceNames)}</td>
                  <td className={table.td}>
                    <span title={e.cancelReason ?? undefined}><Badge tone={st.tone}>{st.label}</Badge></span>
                  </td>
                  <td className={`${table.td} text-right tabular-nums`}>
                    {e.registrationMode === "tickets" ? (
                      <>
                        {e.going}
                        {e.pending ? <span className="ml-1 text-xs text-orange" title="Awaiting approval">+{e.pending}</span> : null}
                      </>
                    ) : (
                      <span className="text-xs text-muted">{e.registrationMode === "external" ? "external" : "info"}</span>
                    )}
                  </td>
                  <td className={`${table.td} text-right`}>
                    <EventMenu
                      event={{
                        id: e.id,
                        title: e.title,
                        status: e.status,
                        is_featured: e.featured,
                        needs_review: e.needsReview,
                        organiser_id: e.organiserId,
                        registration_mode: e.registrationMode,
                        source_url: e.sourceUrl,
                      }}
                    />
                  </td>
                </tr>
              );
  }

  return (
    <>
      <div
        aria-live="polite"
        className={`mb-3 flex flex-wrap items-center gap-2 rounded-[16px] border border-accent/25 bg-accent/[0.07] px-3.5 py-2.5 text-sm transition-colors ${
          selected.size ? "" : "hidden"
        }`}
      >
        <span className="font-medium tabular-nums">
          {selected.size} selected
        </span>
        <button type="button" onClick={toggleAll} className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline">
          {allSelected ? "Clear selection" : `Select all ${rows.length} on this page`}
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label htmlFor="bulk-category" className="sr-only">Category for selected events</label>
          <select
            id="bulk-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-[34px] rounded-[10px] border border-ink/12 bg-ink/[0.05] px-2 text-xs text-fg"
          >
            <option value="" disabled>Set category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="__none">No category</option>
          </select>
          <button
            type="button"
            onClick={applyCategory}
            disabled={!category || pending}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            Apply
          </button>
          <button type="button" onClick={() => setSelected(new Set())} className={buttonClass({ variant: "ghost", size: "sm" })}>
            Clear
          </button>
          <button
            type="button"
            onClick={() => { setError(null); setConfirm("remove"); }}
            disabled={pending || chosen.length === 0}
            className={buttonClass({ variant: "secondary", size: "sm" })}
          >
            <IconEyeOff size={14} /> Remove (hide)…
          </button>
          <button
            type="button"
            onClick={() => { setError(null); setConfirm("delete"); }}
            disabled={pending || chosen.length === 0}
            className={buttonClass({ variant: "danger", size: "sm" })}
          >
            <IconTrash size={14} /> Delete permanently…
          </button>
        </div>
      </div>

      <div className={table.wrap}>
        <table className={table.table}>
          <thead>
            <tr>
              <th className={`${table.th} w-10 pr-0`}>
                <input
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  type="checkbox"
                  className={checkboxClass}
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={allSelected ? "Clear selection" : `Select all ${rows.length} events on this page`}
                />
              </th>
              <th className={table.th}>Event</th>
              <th className={table.th}>When</th>
              <th className={table.th}>Organiser</th>
              <th className={table.th}>Source</th>
              <th className={table.th}>Status</th>
              <th className={`${table.th} text-right`}>Going</th>
              <th className={table.th}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block) => {
              if (block.kind === "event") return renderRow(block.row, false);
              const ids = block.rows.map((r) => r.id);
              const ticked = ids.filter((id) => selected.has(id)).length;
              const expanded = open.has(block.key);
              const first = block.rows[0];
              const statuses = new Set(block.rows.map((r) => r.status));
              const st: { label: string; tone: Tone } | null = statuses.size === 1 ? EVENT_STATUS[first.status] : null;
              return [
                <tr key={block.key} className={`${table.tr} ${ticked === ids.length ? "bg-accent/[0.06]" : ""}`}>
                  <td className={`${table.td} w-10 pr-0`}>
                    <input
                      ref={(el) => { if (el) el.indeterminate = ticked > 0 && ticked < ids.length; }}
                      type="checkbox"
                      className={checkboxClass}
                      checked={ticked === ids.length}
                      onChange={() => toggleMany(ids)}
                      aria-label={`Select all ${ids.length} dates of ${first.title}`}
                    />
                  </td>
                  <td className={`${table.td} min-w-52 max-w-80`}>
                    <button
                      type="button"
                      onClick={() => toggleOpen(block.key)}
                      aria-expanded={expanded}
                      className="group flex w-full items-start gap-2 text-left"
                    >
                      <span aria-hidden className={`mt-0.5 text-subtle transition-transform ${expanded ? "rotate-90" : ""}`}>▸</span>
                      <span className="min-w-0">
                        <span className="line-clamp-1 font-medium transition-colors group-hover:text-accent">{first.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-subtle">
                          <Badge tone="brand">{ids.length} dates</Badge>
                          {repeatSummary(block.rows)}
                          {block.rows.some((r) => r.needsReview) && <Badge tone="warning"><IconFlag size={11} /> Needs review</Badge>}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className={`${table.td} whitespace-nowrap text-muted tabular-nums`}>
                    {first.when}
                    <span className="block text-xs text-subtle">+{ids.length - 1} more</span>
                  </td>
                  <td className={table.td}>
                    {first.organiser ? <span className="line-clamp-1">{first.organiser.name}</span> : <span className="text-muted">—</span>}
                  </td>
                  <td className={`${table.td} text-muted`}>{sourceLabel(first.source, sourceNames)}</td>
                  <td className={table.td}>{st ? <Badge tone={st.tone}>{st.label}</Badge> : <Badge>Mixed</Badge>}</td>
                  <td className={`${table.td} text-right text-xs text-muted`}>
                    {first.registrationMode === "tickets" ? block.rows.reduce((n, r) => n + r.going, 0) : first.registrationMode === "external" ? "external" : "info"}
                  </td>
                  <td className={`${table.td} text-right`}>
                    <button type="button" onClick={() => toggleOpen(block.key)} className="text-xs text-muted transition-colors hover:text-fg">
                      {expanded ? "Hide dates" : "Show dates"}
                    </button>
                  </td>
                </tr>,
                ...(expanded ? block.rows.map((r) => renderRow(r, true)) : []),
              ];
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirm !== null}
        pending={pending}
        error={error}
        onClose={() => { if (!pending) setConfirm(null); }}
        onConfirm={confirm === "delete" ? hardDelete : remove}
        options={
          confirm === "delete"
            ? {
                title: chosen.length === 1 ? "Delete 1 event permanently?" : `Delete ${chosen.length} events permanently?`,
                body: (
                  <>
                    This erases the event{chosen.length === 1 ? "" : "s"} and everything attached — registrations,
                    tickets, questions, saved items and check-in history. It leaves the database entirely and{" "}
                    <b>cannot be undone</b>. Choose Remove instead if you only want it hidden.
                  </>
                ),
                confirmLabel: chosen.length === 1 ? "Delete permanently" : `Delete ${chosen.length} permanently`,
                danger: true,
              }
            : {
                title: chosen.length === 1 ? "Remove 1 event?" : `Remove ${chosen.length} events?`,
                body: "They'll be hidden from ORBIT completely (spam, duplicates, wrong info) but stay in the database. You can restore them one at a time later.",
                confirmLabel: chosen.length === 1 ? "Remove event" : `Remove ${chosen.length} events`,
                danger: true,
                reason: { label: "Internal note", placeholder: "Optional — e.g. duplicate imports from the Meetup find page" },
              }
        }
      />
    </>
  );
}
