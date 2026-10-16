"use client";

import { useState } from "react";

export type ChipOption = { value: string; label: string };

/**
 * Pill-style multi (or single) select that submits with a normal <form>:
 * each selected value is rendered as a hidden input named `name`.
 */
export function ChipGroup({ name, options, defaultValue = [], multiple = true, max, onChange }: {
  name: string;
  options: ChipOption[];
  defaultValue?: string[];
  multiple?: boolean;
  max?: number;
  onChange?: (values: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(defaultValue);

  function toggle(value: string) {
    let next: string[];
    if (!multiple) next = selected[0] === value ? [] : [value];
    else if (selected.includes(value)) next = selected.filter((v) => v !== value);
    else if (max && selected.length >= max) return;
    else next = [...selected, value];
    setSelected(next);
    onChange?.(next);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              on
                ? "bg-gradient border-transparent font-medium text-bg"
                : "border-ink/10 bg-ink/[0.045] text-muted hover:border-ink/20 hover:bg-ink/[0.08] hover:text-fg"
            }`}
          >
            {on && (
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M3.5 8.5l3 3 6-7" />
              </svg>
            )}
            {o.label}
          </button>
        );
      })}
      {selected.map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}
    </div>
  );
}
