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
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`glass-strong pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-2xl px-4 py-3 text-sm text-fg ${
            t.tone === "error" ? "!border-red-400/30" : ""
          }`}
        >
          <span
            aria-hidden
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              t.tone === "error" ? "bg-red-400/20 text-red-300" : "bg-accent/20 text-accent"
            }`}
          >
            {t.tone === "error" ? "!" : "✓"}
          </span>
          <span className={t.tone === "error" ? "text-red-100" : ""}>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
