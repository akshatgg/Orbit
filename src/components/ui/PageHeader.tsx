import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action, back }: {
  title: string; subtitle?: ReactNode; action?: ReactNode; back?: ReactNode;
}) {
  return (
    <header className="px-4 pb-4 pt-[max(env(safe-area-inset-top),1.5rem)]">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-semibold tracking-wide">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
