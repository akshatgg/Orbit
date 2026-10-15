import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action, back }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode;
}) {
  return (
    <header className="px-4 pb-5 pt-[max(env(safe-area-inset-top),1.5rem)]">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-semibold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

/** Small uppercase label above headings. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-subtle ${className}`}>{children}</p>
  );
}
