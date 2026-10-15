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
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              on ? "border-transparent bg-gradient font-medium text-bg" : "border-line bg-surface text-muted hover:text-fg"
            }`}
          >
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
