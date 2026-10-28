"use client";

import Link from "next/link";
import { lazy, Suspense, useState } from "react";

// The sheet, its list and actions load on first tap: cards and the event page only carry this button.
const ShareSheet = lazy(() => import("./ShareSheet").then((m) => ({ default: m.ShareSheet })));

const SHARE_GROUP_PATH = "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6.5 9a6.5 6.5 0 0 1 10.4-5.2M18 14v6M15 17h6";

const roundBtn =
  "round-btn flex h-10 w-10 items-center justify-center rounded-full transition duration-200 hover:brightness-125 active:scale-95 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const textBtn =
  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent";

/**
 * "Share with Circle" — on the event page (round, beside Share / Save) and in EventCard's actions slot
 * (text). Nothing is fetched until it's tapped; signed-out visitors are sent to sign in first.
 */
export function ShareToGroupButton({ eventId, eventTitle, signedIn = true, variant = "round" }: {
  eventId: string;
  eventTitle: string;
  signedIn?: boolean;
  variant?: "round" | "text";
}) {
  const [open, setOpen] = useState(false);
  // Bumped on every opening so the sheet remounts with a fresh list.
  const [session, setSession] = useState(0);
  const label = "Share with a Circle";
  const cls = variant === "round" ? roundBtn : textBtn;
  const icon = (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${variant === "round" ? "h-[18px] w-[18px]" : "h-3.5 w-3.5"}`} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={SHARE_GROUP_PATH} />
    </svg>
  );

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/events/${eventId}`)}`} aria-label="Sign in to share with a Circle" title={label} className={cls}>
        {icon}
        {variant === "text" && "Share with Circle"}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="dialog"
        className={cls}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        {icon}
        {variant === "text" && "Share with Circle"}
      </button>
      {session > 0 && (
        <Suspense fallback={null}>
          <ShareSheet key={session} eventId={eventId} eventTitle={eventTitle} open={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
