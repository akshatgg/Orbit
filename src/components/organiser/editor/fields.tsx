"use client";

import type { ReactNode } from "react";
import type { EventForm } from "@/lib/organiser/event-form";

export type StepProps = {
  form: EventForm;
  update: (patch: Partial<EventForm>) => void;
  errors: Record<string, string>;
};

/** Section heading inside a step. */
export function StepIntro({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children && <p className="mt-1 text-sm text-muted">{children}</p>}
    </div>
  );
}

/** "42/200" under text inputs. */
export function Counter({ value, max }: { value: string; max: number }) {
  const n = value.length;
  return (
    <span className={`text-[11px] tabular-nums ${n > max ? "text-red-300" : n > max * 0.9 ? "text-orange" : "text-muted"}`}>
      {n}/{max}
    </span>
  );
}

/** Accessible on/off switch. */
export function Toggle({ id, checked, onChange, label, description }: {
  id: string; checked: boolean; onChange: (on: boolean) => void; label: string; description?: string;
}) {
  return (
    <div className="glass flex items-start justify-between gap-4 rounded-[16px] px-4 py-3.5">
      <div>
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${checked ? "bg-gradient" : "bg-ink/[0.1] ring-1 ring-inset ring-ink/10"}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full shadow-md transition-transform duration-200 ease-out motion-reduce:transition-none ${checked ? "translate-x-[1.375rem] bg-bg" : "translate-x-0.5 bg-fg"}`} />
      </button>
    </div>
  );
}

/** Segmented single choice (e.g. In person / Online / Hybrid). */
export function Segmented<T extends string>({ value, options, onChange, label }: {
  value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="glass flex gap-1 rounded-full p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition duration-200 ${on ? "bg-gradient text-bg" : "text-muted hover:text-fg"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** £ input. */
export function MoneyInput({ id, value, onChange, invalid, label }: {
  id: string; value: string; onChange: (v: string) => void; invalid?: boolean; label?: string;
}) {
  return (
    <div className={`flex items-center overflow-hidden rounded-[14px] border bg-ink/[0.045] light:bg-surface light:border-line transition duration-200 focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/15 ${invalid ? "border-red-400/60" : "border-ink/10"}`}>
      <span className="select-none pl-3.5 text-sm text-muted" aria-hidden>£</span>
      <input
        id={id}
        inputMode="decimal"
        aria-label={label}
        aria-invalid={invalid}
        value={value}
        placeholder="0"
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        className="min-w-0 flex-1 bg-transparent px-2 py-3 text-sm text-fg outline-none placeholder:text-subtle"
      />
    </div>
  );
}
