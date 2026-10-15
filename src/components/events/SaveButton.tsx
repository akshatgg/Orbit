"use client";

import { useOptimistic, useTransition } from "react";
import { toggleSaved } from "@/lib/actions/user-events";

export function SaveButton({ eventId, saved, className = "" }: { eventId: string; saved: boolean; className?: string }) {
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
          await toggleSaved(eventId, !optimistic);
        });
      }}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-line bg-bg/70 backdrop-blur transition-colors hover:text-fg ${
        optimistic ? "text-pink" : "text-muted"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={optimistic ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
