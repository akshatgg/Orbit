"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconX } from "./icons";

/** Side sheet on desktop, bottom sheet on phones. Built on <dialog> for focus + Esc handling. */
export function Drawer({ trigger, title, subtitle, children, triggerClassName = "" }: {
  trigger: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-haspopup="dialog">
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === ref.current) setOpen(false); }}
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border border-line bg-surface p-0 text-fg backdrop:bg-bg/70 backdrop:backdrop-blur-sm sm:ml-auto sm:mt-0 sm:h-dvh sm:max-h-none sm:w-[28rem] sm:rounded-none sm:rounded-l-3xl"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate font-display text-lg font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="px-5 py-5">{open && children}</div>
      </dialog>
    </>
  );
}
