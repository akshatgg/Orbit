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
        className="glass-strong m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[24px] p-0 text-fg backdrop:bg-black/50 backdrop:backdrop-blur-md sm:ml-auto sm:mt-0 sm:h-dvh sm:max-h-none sm:w-[30rem] sm:rounded-none sm:rounded-l-[24px]"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-line bg-[rgb(18_18_26/0.55)] px-6 py-4 backdrop-blur-xl">
          <div className="min-w-0">
            <h2 id={titleId} className="truncate text-lg font-semibold tracking-tight">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-white/[0.08] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            <IconX size={18} />
          </button>
        </div>
        <div className="px-6 py-6">{open && children}</div>
      </dialog>
    </>
  );
}
