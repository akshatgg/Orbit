"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setEventMark, setFollow } from "@/lib/actions/user-events";

/** Follow / unfollow toggle for an organiser row. Optimistic, rolls back on error. */
export function FollowToggle({ organiserId, name }: { organiserId: string; name: string }) {
  const [following, setFollowing] = useState(true);
  const [optimistic, setOptimistic] = useOptimistic(following);
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      aria-label={optimistic ? `Unfollow ${name}` : `Follow ${name}`}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const next = !optimistic;
          setOptimistic(next);
          const res = await setFollow(organiserId, next);
          if (res.ok) setFollowing(next);
        })
      }
      className={`h-8 shrink-0 rounded-full border px-3.5 text-xs font-semibold transition-colors ${
        optimistic
          ? "border-line bg-surface-2 text-fg hover:border-red-500/40 hover:text-red-300"
          : "border-transparent bg-gradient text-bg"
      }`}
    >
      {optimistic ? "Following" : "Follow"}
    </button>
  );
}

/** "I went" toggle for past events — sets the `attended` mark. */
export function AttendedToggle({ eventId, attended }: { eventId: string; attended: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(attended);
  const [, startTransition] = useTransition();

  return (
    <button
      type="button"
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          setOptimistic(!optimistic);
          await setEventMark(eventId, "attended", !optimistic);
        })
      }
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors ${
        optimistic
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
          : "border-line text-muted hover:border-violet/50 hover:text-fg"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        {optimistic ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <path d="M12 5v14M5 12h14" />}
      </svg>
      I went
    </button>
  );
}
