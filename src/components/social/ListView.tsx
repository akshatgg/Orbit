"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useOptimistic, useTransition, type ComponentProps, type ReactNode } from "react";
import { VIEW_COOKIES, type ListView, type ViewScope } from "@/lib/social/view";
import { SocialIcon } from "./icons";

type ViewState = { view: ListView; pending: boolean; setView: (view: ListView) => void };

const ViewContext = createContext<ViewState | null>(null);

const YEAR = 60 * 60 * 24 * 365;

/**
 * A screen's grid / list choice. The server renders `view` (read from the cookie), so the first
 * paint is already right; switching saves the cookie and re-renders the page on the server.
 */
export function ViewProvider({ scope, view, children }: { scope: ViewScope; view: ListView; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic(view);

  function setView(next: ListView) {
    if (next === shown) return;
    document.cookie = `${VIEW_COOKIES[scope]}=${next}; path=/; max-age=${YEAR}; samesite=lax`;
    startTransition(() => {
      setShown(next);
      router.refresh();
    });
  }

  return <ViewContext value={{ view: shown, pending, setView }}>{children}</ViewContext>;
}

const OPTIONS = [
  { value: "grid", label: "Grid view" },
  { value: "list", label: "List view" },
] as const;

/** Two-icon segmented switch: grid ↔ list. Render inside a <ViewProvider>. */
export function ViewToggle({ className = "" }: { className?: string }) {
  const state = use(ViewContext);
  if (!state) return null;
  return (
    <div role="group" aria-label="Layout" className={`inline-flex shrink-0 gap-0.5 rounded-full bg-ink/[0.06] p-1 light:rounded-xl ${className}`}>
      {OPTIONS.map((o) => {
        const on = state.view === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            aria-label={o.label}
            title={o.label}
            onClick={() => state.setView(o.value)}
            className={`flex h-[34px] w-9 items-center justify-center rounded-full transition duration-200 ease-out light:rounded-lg motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              on ? "bg-[var(--seg-on)] text-fg shadow-[var(--seg-shadow)]" : "text-muted hover:text-fg"
            }`}
          >
            <SocialIcon name={o.value} className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

/** The list the switch lays out: dims while the other layout is on its way. */
export function ViewList({ className = "", ...props }: ComponentProps<"ul">) {
  const pending = use(ViewContext)?.pending ?? false;
  return (
    <ul
      aria-busy={pending || undefined}
      className={`transition-opacity duration-200 motion-reduce:transition-none ${pending ? "opacity-60" : ""} ${className}`}
      {...props}
    />
  );
}
