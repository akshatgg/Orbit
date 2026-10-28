"use client";

import { useOptimistic, useState, useTransition } from "react";
import { setInterest } from "@/lib/social/actions";
import type { InterestStatus } from "@/types/social";
import { SocialIcon } from "./icons";

const OPTIONS: { value: InterestStatus; label: string; icon: "star" | "check" }[] = [
  { value: "interested", label: "I'm interested", icon: "star" },
  { value: "going", label: "Count me in", icon: "check" },
];

/**
 * "I'm interested" / "Count me in" on a circle's shared event. Optimistic: the pick shows at once and
 * rolls back by itself if the API refuses (the page re-renders with everyone's avatars on success).
 * Tapping the active one takes your name off.
 */
export function InterestToggle({ groupId, eventId, status }: { groupId: string; eventId: string; status: InterestStatus | null }) {
  const [optimistic, setOptimistic] = useOptimistic(status);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function pick(value: InterestStatus) {
    const next = optimistic === value ? null : value;
    startTransition(async () => {
      setError(null);
      setOptimistic(next);
      const result = await setInterest(groupId, eventId, next);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <div role="group" aria-label="Your plans" className="flex gap-1.5">
        {OPTIONS.map((o) => {
          const on = optimistic === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              aria-busy={pending && on}
              onClick={() => pick(o.value)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                on ? "bg-gradient border-transparent text-bg" : "border-ink/10 bg-ink/[0.05] text-fg hover:bg-ink/[0.1]"
              }`}
            >
              <SocialIcon name={o.icon} className="h-3.5 w-3.5" strokeWidth={2.2} />
              {o.label}
            </button>
          );
        })}
      </div>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
