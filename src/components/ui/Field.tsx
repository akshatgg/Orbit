import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-fg placeholder:text-muted/60 outline-none transition-colors focus:border-violet disabled:opacity-60 aria-[invalid=true]:border-red-400";

/** Label + control + hint/error, stacked. */
export function Field({ label, hint, error, children, htmlFor, required }: {
  label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
        {required && <span className="ml-0.5 text-orange">*</span>}
      </label>
      {children}
      {error ? <p className="text-xs text-red-300">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClass} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${inputClass} min-h-24 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${inputClass} appearance-none ${className}`} {...props} />;
}

/** Inline success / error message under a form. */
export function FormMessage({ state }: { state?: { ok?: boolean; error?: string; message?: string } | null }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="text-sm text-red-300">{state.error}</p>;
  if (state.message) return <p role="status" className="text-sm text-emerald-300">{state.message}</p>;
  return null;
}
