"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import type { ActionState } from "../actions";
import { ActionButton } from "./ActionButton";

type Selection = { selected: ReadonlySet<string>; toggle: (id: string) => void };
const SelectionContext = createContext<Selection | null>(null);

/**
 * Lets the admin tick several review rows and mark them reviewed in one go. Holds the selection
 * for the rows on screen (`ids`); rows that leave the page after the action drop out of it.
 */
export function ReviewSelection({ ids, action, children }: {
  ids: string[];
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
}) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
  // The button that ran the action unmounts once its rows leave, so the toolbar keeps the outcome.
  const [result, setResult] = useState<ActionState>(null);
  const run = async (state: ActionState, formData: FormData) => {
    const next = await action(state, formData);
    setResult(next);
    if (next?.ok) setPicked(new Set());
    return next;
  };
  const selected = new Set(ids.filter((id) => picked.has(id)));
  const all = ids.length > 0 && selected.size === ids.length;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SelectionContext.Provider value={{ selected, toggle }}>
      <div className="glass-strong sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-2.5">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={all}
            ref={(el) => { if (el) el.indeterminate = selected.size > 0 && !all; }}
            onChange={() => setPicked(all ? new Set() : new Set(ids))}
            className="h-4 w-4 accent-[var(--color-accent)]"
          />
          <span className="font-medium">{selected.size > 0 ? `${selected.size} selected` : "Select all on this page"}</span>
        </label>
        {result && selected.size === 0 && (
          <p role={result.ok ? "status" : "alert"} className={`text-xs ${result.ok ? "text-emerald-300" : "text-red-300"}`}>
            {result.ok ? result.message : result.error}
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <button type="button" onClick={() => setPicked(new Set())} className="rounded-full px-2.5 py-1 text-xs text-muted transition-colors hover:text-fg">
              Clear
            </button>
          )}
          {selected.size > 0 ? (
            <ActionButton
              action={run}
              fields={{ ids: [...selected].join(",") }}
              variant="primary"
              pendingText="Marking…"
              resultClassName="text-right"
              confirm={{
                title: `Mark ${selected.size} event${selected.size === 1 ? "" : "s"} reviewed?`,
                body: "They leave the queue. The events themselves stay as they are.",
                confirmLabel: "Mark reviewed",
              }}
            >
              Mark {selected.size} reviewed
            </ActionButton>
          ) : (
            <Button type="button" size="sm" variant="secondary" disabled>Mark reviewed</Button>
          )}
        </div>
      </div>
      {children}
    </SelectionContext.Provider>
  );
}

/** The tick box on one review row. */
export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const selection = useContext(SelectionContext);
  if (!selection) return null;
  return (
    <input
      type="checkbox"
      aria-label={`Select ${label}`}
      checked={selection.selected.has(id)}
      onChange={() => selection.toggle(id)}
      className="h-4 w-4 accent-[var(--color-accent)]"
    />
  );
}
