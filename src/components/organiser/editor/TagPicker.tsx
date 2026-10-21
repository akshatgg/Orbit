"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";
import { ALL_INTERESTS } from "@/lib/taxonomy";

const SUGGESTIONS = ALL_INTERESTS;

const MAX_TAGS = 10;

/** Interest chips (so events match students' interests) plus custom tags. */
export function TagPicker({ value, onChange, error }: { value: string[]; onChange: (tags: string[]) => void; error?: string }) {
  const [custom, setCustom] = useState("");
  const selected = new Set(value);
  const full = value.length >= MAX_TAGS;
  const customTags = value.filter((t) => !SUGGESTIONS.some((s) => s.value === t));

  function toggle(tag: string) {
    if (selected.has(tag)) onChange(value.filter((t) => t !== tag));
    else if (!full) onChange([...value, tag]);
  }

  function addCustom() {
    const tag = custom.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 30);
    if (tag && !selected.has(tag) && !full) onChange([...value, tag]);
    setCustom("");
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1.5 text-xs transition duration-200 active:scale-[0.97] motion-reduce:transition-none ${
      on ? "border-transparent bg-gradient font-semibold text-bg" : "border-ink/10 bg-ink/[0.045] text-muted hover:border-ink/20 hover:bg-ink/[0.08] hover:text-fg disabled:opacity-40"
    }`;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button key={s.value} type="button" aria-pressed={selected.has(s.value)} disabled={full && !selected.has(s.value)} onClick={() => toggle(s.value)} className={chip(selected.has(s.value))}>
            {s.label}
          </button>
        ))}
        {customTags.map((t) => (
          <button key={t} type="button" aria-pressed onClick={() => toggle(t)} className={chip(true)} aria-label={`Remove tag ${t}`}>
            #{t} <span aria-hidden>×</span>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addCustom();
            }
          }}
          disabled={full}
          maxLength={30}
          aria-label="Add your own tag"
          placeholder={full ? "10 tags max" : "Add your own tag, e.g. case interviews"}
          className={`${inputClass} min-w-0 flex-1 py-2.5`}
        />
        <button type="button" onClick={addCustom} disabled={!custom.trim() || full} className={buttonClass({ variant: "secondary" }) + " h-auto"}>
          Add
        </button>
      </div>
      <p className={`text-xs ${error ? "text-red-300" : "text-muted"}`}>
        {error ?? `${value.length}/${MAX_TAGS} — tags help ORBIT recommend your event to the right students.`}
      </p>
    </div>
  );
}
