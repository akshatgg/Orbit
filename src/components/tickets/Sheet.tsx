"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bottom sheet built on the native <dialog> (focus trap, Esc to close, inert background).
 * Controlled with `open` / `onClose`.
 */
export function Sheet({ open, onClose, title, children, labelledBy }: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  labelledBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[90dvh] w-full max-w-md overflow-visible bg-transparent p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm open:translate-y-0 open:opacity-100 starting:open:translate-y-8 starting:open:opacity-0 transition-[translate,opacity] duration-300 ease-out"
    >
      <div className="glass-strong relative flex max-h-[90dvh] flex-col overflow-hidden rounded-t-[28px] border-b-0 bg-[rgb(18_18_26/0.78)]">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" aria-hidden />
        <div className="flex items-center justify-between gap-3 px-5 pb-2 pt-3">
          <span className="mx-auto h-1 w-10 rounded-full bg-white/20" aria-hidden />
        </div>
        <div className="flex items-start justify-between gap-3 px-5">
          {title ? <div className="min-w-0 flex-1">{title}</div> : <span />}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-muted transition-colors hover:bg-white/[0.12] hover:text-fg"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="pb-safe overflow-y-auto overscroll-contain px-5 pt-4">{children}</div>
      </div>
    </dialog>
  );
}
