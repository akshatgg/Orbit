"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setFollow } from "@/lib/actions/user-events";

/** Compact Follow / Following text button for the host row. Signed-out visitors are sent to sign in. */
export function FollowText({ organiserId, slug, signedIn, following, className = "" }: {
  organiserId: string; slug: string; signedIn: boolean; following: boolean; className?: string;
}) {
  const [on, setOn] = useState(following);
  const [pending, start] = useTransition();
  const cls = `shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-accent transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60 ${className}`;

  if (!signedIn) {
    return <Link href={`/login?next=${encodeURIComponent(`/o/${slug}`)}`} className={cls}>Follow</Link>;
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          const r = await setFollow(organiserId, next);
          if (!r.ok) setOn(!next);
        });
      }}
      className={cls}
    >
      {on ? "Following" : "Follow"}
    </button>
  );
}
