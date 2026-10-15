"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/Field";

const noopSubscribe = () => () => {};

export type ConfirmOptions = {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Ask for a reason / note before confirming. */
  reason?: { label: string; placeholder?: string; required?: boolean; defaultValue?: string };
};

/**
 * Modal confirm built on <dialog> (focus trap, Esc to close, inert background for free).
 * Rendered in a portal so it survives closing the menu that opened it.
 */
export function ConfirmDialog({
  open, options, pending, error, onConfirm, onClose,
}: {
  open: boolean;
  options: ConfirmOptions;
  pending?: boolean;
  error?: string | null;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Portals need document.body, which only exists in the browser.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [reason, setReason] = useState(options.reason?.defaultValue ?? "");
  const titleId = useId();
  const reasonId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open, mounted]);

  if (!mounted) return null;
  const needsReason = options.reason?.required && reason.trim().length === 0;

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current && !pending) onClose(); }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-fg shadow-2xl backdrop:bg-bg/70 backdrop:backdrop-blur-sm"
    >
      <form
        method="dialog"
        className="space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (!needsReason && !pending) onConfirm(reason.trim());
        }}
      >
        <h2 id={titleId} className="font-display text-lg font-semibold">{options.title}</h2>
        {options.body && <div className="text-sm text-muted">{options.body}</div>}
        {options.reason && (
          <div className="space-y-1.5">
            <label htmlFor={reasonId} className="block text-sm font-medium">
              {options.reason.label}
              {options.reason.required && <span className="ml-0.5 text-orange">*</span>}
            </label>
            <textarea
              id={reasonId}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={options.reason.placeholder}
              maxLength={500}
              rows={3}
              autoFocus
              className={`${inputClass} min-h-20`}
            />
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={pending} className={buttonClass({ variant: "ghost", size: "md" })}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || needsReason}
            aria-busy={pending}
            autoFocus={!options.reason}
            className={buttonClass({ variant: options.danger ? "danger" : "primary", size: "md" })}
          >
            {pending ? "Working…" : options.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}
