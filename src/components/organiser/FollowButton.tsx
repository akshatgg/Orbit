"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/Button";
import { setFollow } from "@/lib/actions/user-events";

/** Follow / Following toggle with a live follower count. Signed-out visitors are sent to sign in. */
export function FollowButton({ organiserId, slug, signedIn, following, count }: {
  organiserId: string; slug: string; signedIn: boolean; following: boolean; count: number;
}) {
  const [on, setOn] = useState(following);
  const [n, setN] = useState(count);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const label = `${n} follower${n === 1 ? "" : "s"}`;

  function toggle() {
    const next = !on;
    setOn(next);
    setN((c) => Math.max(0, c + (next ? 1 : -1)));
    setError(null);
    start(async () => {
      const r = await setFollow(organiserId, next);
      if (!r.ok) {
        setOn(!next);
        setN((c) => Math.max(0, c + (next ? -1 : 1)));
        setError(r.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex items-center gap-3">
        {signedIn ? (
          <button type="button" onClick={toggle} disabled={pending} aria-pressed={on}
            className={buttonClass({ variant: on ? "secondary" : "primary", size: "md" })}>
            {on ? "Following ✓" : "Follow"}
          </button>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/o/${slug}`)}`} className={buttonClass({ size: "md" })}>Follow</Link>
        )}
        <span className="text-sm text-muted" aria-live="polite">{label}</span>
      </div>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
