"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconDots } from "./icons";

/**
 * "⋯" menu for table rows. The panel is rendered into <body> with fixed positioning, so the table's
 * scroll container can't clip it or scroll the row away when it opens. It is hidden with CSS (not
 * unmounted) so confirm dialogs opened from an item stay alive after the menu closes.
 */
const noopSubscribe = () => () => {};

export function RowMenu({ children, label = "Actions" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  // True only in the browser, so the portal never renders during SSR.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number }>({ right: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const toggle = () => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!open && r) {
      const right = Math.max(8, window.innerWidth - r.right);
      const panelH = panelRef.current?.scrollHeight || 280;
      // Open upwards when there isn't room below the button.
      setPos(window.innerHeight - r.bottom < panelH + 16 && r.top > panelH + 16
        ? { bottom: window.innerHeight - r.top + 6, right }
        : { top: r.bottom + 6, right });
    }
    setOpen((o) => !o);
  };

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!buttonRef.current?.contains(t) && !panelRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  const panel = (
    <div
      ref={panelRef}
      id={id}
      role="menu"
      onClick={() => setOpen(false)}
      style={{ position: "fixed", top: pos.top, bottom: pos.bottom, right: pos.right }}
      className={`${open ? "" : "hidden"} glass-strong z-[60] w-56 rounded-2xl p-1.5`}
    >
      {children}
    </div>
  );

  return (
    <div className="inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={toggle}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-ink/[0.08] hover:text-fg aria-expanded:bg-ink/[0.08] aria-expanded:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <IconDots size={18} />
      </button>
      {mounted ? createPortal(panel, document.body) : null}
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
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-fg transition-colors hover:bg-ink/[0.08]"
    >
      {children}
    </a>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}
