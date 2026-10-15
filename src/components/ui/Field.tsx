import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "w-full rounded-[14px] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-fg placeholder:text-subtle outline-none backdrop-blur-xl shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] transition duration-200 ease-out hover:border-white/15 focus:border-accent/60 focus:bg-white/[0.07] focus:ring-4 focus:ring-accent/15 disabled:opacity-60 aria-[invalid=true]:border-red-400/60 aria-[invalid=true]:ring-red-400/10";

/** Label + control + hint/error, stacked. */
export function Field({ label, hint, error, children, htmlFor, required }: {
  label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg/90">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
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
