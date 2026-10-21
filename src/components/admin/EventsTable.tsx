"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { removeEvents, setEventsCategory } from "@/app/admin/events/actions";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { EVENT_STATUS, sourceLabel, type Tone } from "@/lib/admin/labels";
import type { EventStatus, RegistrationMode } from "@/types/database";
import { ConfirmDialog } from "./ConfirmDialog";
import { EventMenu } from "./EventActions";
import { IconStar, IconFlag, IconTrash } from "./icons";
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
};

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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("");
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
        setConfirmOpen(false);
        setSelected(new Set());
        toast(result.message ?? "Events removed");
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
            onClick={() => { setError(null); setConfirmOpen(true); }}
            disabled={pending || chosen.length === 0}
            className={buttonClass({ variant: "danger", size: "sm" })}
          >
            <IconTrash size={14} /> Remove selected…
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
            {rows.map((e) => {
              const st: { label: string; tone: Tone } = EVENT_STATUS[e.status];
              const checked = selected.has(e.id);
              return (
                <tr
                  key={e.id}
                  className={`${table.tr} ${checked ? "bg-accent/[0.06]" : ""} ${e.status === "removed" ? "opacity-60" : ""}`}
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
                  <td className={`${table.td} min-w-52 max-w-80`}>
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
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        pending={pending}
        error={error}
        onClose={() => { if (!pending) setConfirmOpen(false); }}
        onConfirm={remove}
        options={{
          title: chosen.length === 1 ? "Remove 1 event?" : `Remove ${chosen.length} events?`,
          body: "They'll be hidden from ORBIT completely (spam, duplicates, wrong info). You can restore them one at a time later.",
          confirmLabel: chosen.length === 1 ? "Remove event" : `Remove ${chosen.length} events`,
          danger: true,
          reason: { label: "Internal note", placeholder: "Optional — e.g. duplicate imports from the Meetup find page" },
        }}
      />
    </>
  );
}
