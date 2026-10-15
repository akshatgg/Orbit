"use client";

import { useSyncExternalStore } from "react";

type Toast = { id: number; tone: "success" | "error"; text: string };

// Tiny module-level store so any admin control can raise a toast without context plumbing.
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, tone: Toast["tone"] = "success") {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, tone, text }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, tone === "error" ? 7000 : 3500);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Toast[] = [];

/** Render once per admin page. */
export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:left-auto">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`pointer-events-auto max-w-sm rounded-xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur ${
            t.tone === "error"
              ? "border-red-500/40 bg-red-950/80 text-red-200"
              : "border-violet/40 bg-surface/90 text-fg"
          }`}
        >
          {t.tone === "success" && <span className="text-gradient mr-1.5 font-semibold">✓</span>}
          {t.text}
        </div>
      ))}
    </div>
  );
}
