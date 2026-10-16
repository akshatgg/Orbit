import type { ReactNode } from "react";

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-4 flex flex-col items-center rounded-[22px] border border-dashed border-white/12 bg-white/[0.025] px-6 py-10 text-center backdrop-blur-xl">
      <p className="text-base font-semibold tracking-tight">{title}</p>
      {children && <div className="mt-1.5 text-sm text-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
