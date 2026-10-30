"use client";

import { useOptimistic, useTransition } from "react";
import { markInstallMoment } from "@/components/pwa/install-store";
import { toggleSaved } from "@/lib/actions/user-events";

export function SaveButton({ eventId, saved, className = "", onSaved }: {
  eventId: string;
  saved: boolean;
  className?: string;
  /** For a list that keeps the state itself (an open chat isn't re-rendered by the server). */
  onSaved?: (saved: boolean) => void;
}) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? "Remove from saved" : "Save event"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startTransition(async () => {
          setOptimistic(!optimistic);
          if (!optimistic) markInstallMoment();
          await toggleSaved(eventId, !optimistic);
          onSaved?.(!optimistic);
        });
      }}
      className={`glass-float flex h-9 w-9 items-center justify-center rounded-full transition duration-200 ease-out hover:brightness-125 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={optimistic ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
