"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { dismissEvent } from "@/lib/actions/user-events";

type Toast = { id: string; title: string; error?: string };
type Ctx = { hidden: ReadonlySet<string>; dismiss: (id: string, title: string) => void };

const DismissContext = createContext<Ctx | null>(null);

const TOAST_MS = 6000;

/**
 * "Not interested" with an optimistic hide and an Undo toast.
 * Wrap a list in <DismissProvider>, each card in <Dismissible>, and put <NotInterestedButton> in the card.
 */
export function DismissProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: Toast | null) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(t);
    if (t) timer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const setHiddenFor = (id: string, on: boolean) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const dismiss = useCallback((id: string, title: string) => {
    setHiddenFor(id, true);
    show({ id, title });
    startTransition(async () => {
      const res = await dismissEvent(id, true);
      if (!res.ok) {
        setHiddenFor(id, false);
        show({ id, title, error: res.error });
      }
    });
  }, [show]);

  function undo() {
    if (!toast) return;
    const { id, title } = toast;
    setHiddenFor(id, false);
    show(null);
    startTransition(async () => {
      const res = await dismissEvent(id, false);
      if (!res.ok) {
        setHiddenFor(id, true);
        show({ id, title, error: res.error });
      }
    });
  }

  return (
    <DismissContext.Provider value={{ hidden, dismiss }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 mx-auto max-w-md px-4 lg:bottom-6 lg:left-64" role="status" aria-live="polite">
        {toast && (
          <div className="glass-strong pointer-events-auto flex items-center gap-3 rounded-[20px] py-2.5 pl-4 pr-2.5 text-sm">
            <p className="min-w-0 flex-1 truncate text-muted">
              {toast.error ? (
                <span className="text-red-300">Couldn’t hide that — {toast.error}</span>
              ) : (
                <>Hidden <span className="text-fg">{toast.title}</span></>
              )}
            </p>
            {!toast.error && (
              <button type="button" onClick={undo} className="shrink-0 rounded-full bg-ink/[0.08] px-3.5 py-1.5 text-xs font-semibold text-fg transition duration-200 hover:bg-ink/[0.14] active:scale-95 motion-reduce:transition-none">
                Undo
              </button>
            )}
          </div>
        )}
      </div>
    </DismissContext.Provider>
  );
}

/** Hides its children once the event is dismissed. */
export function Dismissible({ id, children }: { id: string; children: ReactNode }) {
  const ctx = useContext(DismissContext);
  if (ctx?.hidden.has(id)) return null;
  return <>{children}</>;
}

/** Icon-only dismiss control: a quiet ✕ that hides the event and offers Undo. */
export function NotInterestedButton({ id, title, className = "" }: { id: string; title: string; className?: string }) {
  const ctx = useContext(DismissContext);
  if (!ctx) return null;
  return (
    <button
      type="button"
      onClick={() => ctx.dismiss(id, title)}
      aria-label={`Not interested in ${title}`}
      title="Not interested"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-subtle transition duration-200 hover:bg-ink/[0.08] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
