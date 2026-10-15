import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-4 flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <p className="font-display text-base font-semibold">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
