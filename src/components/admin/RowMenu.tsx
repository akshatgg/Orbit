"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { IconDots } from "./icons";

/**
 * "⋯" menu for table rows. The panel is hidden with CSS (not unmounted) so confirm dialogs
 * opened from an item stay alive after the menu closes.
 */
export function RowMenu({ children, label = "Actions" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-transparent text-muted transition-colors hover:border-line hover:bg-surface-2 hover:text-fg aria-expanded:border-line aria-expanded:bg-surface-2 aria-expanded:text-fg"
      >
        <IconDots size={18} />
      </button>
      <div
        id={id}
        role="menu"
        onClick={() => setOpen(false)}
        className={`${open ? "" : "hidden"} absolute right-0 z-30 mt-1 w-56 rounded-xl border border-line bg-surface p-1 shadow-2xl shadow-black/60`}
      >
        {children}
      </div>
    </div>
  );
}

/** Link row inside a RowMenu. */
export function MenuLink({ href, children, external }: { href: string; children: ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      role="menuitem"
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
    >
      {children}
    </a>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
