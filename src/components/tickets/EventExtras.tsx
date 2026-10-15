"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useState, useTransition } from "react";
import { logInteraction, setEventMark } from "@/lib/actions/user-events";
import { Icon } from "./icons";
import { Sheet } from "./Sheet";

const logged = new Set<string>();

/** Logs one 'view' per page visit from the browser, so link prefetches don't count as views. */
export function ViewLogger({ eventId }: { eventId: string }) {
  useEffect(() => {
    if (logged.has(eventId)) return;
    logged.add(eventId);
    void logInteraction(eventId, "view");
  }, [eventId]);
  return null;
}

const roundBtn =
  "flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-bg/60 text-fg backdrop-blur-md transition-colors hover:bg-bg/80";

/** Native share sheet on phones (WhatsApp etc.), copy-link fallback elsewhere. */
export function ShareButton({ eventId, title, text, className = roundBtn }: {
  eventId: string; title: string; text?: string | null; className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/events/${eventId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: text ?? undefined, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      void logInteraction(eventId, "share");
    } catch {
      // Share sheet dismissed — nothing to do.
    }
  }

  return (
    <span className="relative">
      <button type="button" onClick={share} aria-label="Share event" className={className}>
        <Icon name="share" />
      </button>
      <span role="status" className={`pointer-events-none absolute right-0 top-12 whitespace-nowrap rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-xs text-fg shadow-lg transition-opacity ${copied ? "opacity-100" : "opacity-0"}`}>
        {copied ? "Link copied" : ""}
      </span>
    </span>
  );
}

/** Back to wherever the visitor came from inside ORBIT, or home when they arrived from a shared link. */
export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={() => {
        const fromOrbit = document.referrer && new URL(document.referrer).origin === window.location.origin;
        if (fromOrbit && window.history.length > 1) router.back();
        else router.push(fallback);
      }}
      className={roundBtn}
    >
      <Icon name="back" className="h-5 w-5" />
    </button>
  );
}

/** Save for signed-out visitors: sends them to sign in first. */
export function SignInToSave({ next }: { next: string }) {
  return (
    <Link href={`/login?next=${encodeURIComponent(next)}`} aria-label="Sign in to save" className={roundBtn}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}

/** "Add to calendar": Google Calendar link or an .ics download (Apple / Outlook). */
export function CalendarButton({ eventId, googleUrl, className, children }: {
  eventId: string; googleUrl: string; className?: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const item =
    "flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5 text-left text-sm font-medium transition-colors hover:border-violet/50";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? (
          <>
            <Icon name="calendar" /> Add to calendar
          </>
        )}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={<h2 className="font-display text-lg font-semibold">Add to calendar</h2>}>
        <div className="space-y-2 pb-6">
          <a
            href={googleUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void logInteraction(eventId, "calendar_add");
              setOpen(false);
            }}
            className={item}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue/15 text-blue"><Icon name="calendar" /></span>
            <span className="flex-1">Google Calendar</span>
            <Icon name="external" className="h-4 w-4 text-muted" />
          </a>
          <a href={`/events/${eventId}/calendar.ics`} download onClick={() => setOpen(false)} className={item}>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange/15 text-orange"><Icon name="download" /></span>
            <span className="flex-1">Apple Calendar, Outlook &amp; others <span className="block text-xs font-normal text-muted">Downloads an .ics file</span></span>
          </a>
        </div>
      </Sheet>
    </>
  );
}

/** "Did you register?" switch for events that register on the organiser's own site. */
export function ExternalRegisteredToggle({ eventId, registered, signedIn }: { eventId: string; registered: boolean; signedIn: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(registered);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!signedIn) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/events/${eventId}`)}`} className="text-sm font-medium text-pink hover:underline">
        Sign in to track it
      </Link>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={optimistic}
        aria-label="Mark as registered"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setOptimistic(!optimistic);
            const res = await setEventMark(eventId, "external_registered", !optimistic);
            if (!res.ok) setError(res.error);
          })
        }
        className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${optimistic ? "border-transparent bg-gradient" : "border-line bg-surface-2"}`}
      >
        <span className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-fg shadow transition-[left] ${optimistic ? "left-[1.4rem]" : "left-0.5"}`} />
      </button>
      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
