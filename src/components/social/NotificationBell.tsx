"use client";

import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState } from "react";
import { useBadges } from "./badges";
import { CountDot, SocialIcon } from "./icons";

// The list, its actions and avatars load only when someone opens the bell.
const NotificationPanel = dynamic(() => import("./NotificationPanel").then((m) => m.NotificationPanel), {
  ssr: false,
  loading: () => <PanelSkeleton />,
});

/**
 * The bell: unread badge (one shared poll, see ./badges) and, on open, a lazily loaded panel with the
 * latest notifications. `placement="bar"` is the phone top bar (panel spans the screen), `"header"`
 * the desktop header (dropdown).
 */
export function NotificationBell({ placement, className = "" }: { placement: "bar" | "header"; className?: string }) {
  const { notifications: unread, signedOut } = useBadges();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  if (signedOut) return null;

  const position = placement === "bar"
    ? "fixed inset-x-3 top-[calc(max(env(safe-area-inset-top),1.25rem)+3.25rem)] max-h-[min(70dvh,34rem)]"
    : "absolute right-0 top-[calc(100%+0.6rem)] w-[23rem] max-h-[min(75dvh,36rem)]";

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        title="Notifications"
        onClick={() => setOpen((o) => !o)}
        className={`relative flex items-center justify-center rounded-full transition duration-200 ease-out hover:text-fg active:scale-95 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${open ? "text-fg" : "text-muted"} ${className}`}
      >
        <SocialIcon name="bell" />
        <CountDot count={unread} label="unread" />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          className={`${position} z-50 flex flex-col overflow-hidden rounded-[22px] border border-line bg-raised text-fg shadow-[0_24px_60px_-20px_rgb(0_0_0/0.55)]`}
        >
          <NotificationPanel onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function PanelSkeleton() {
  return (
    <ul aria-busy="true" aria-label="Loading" className="space-y-3 p-4">
      {[0, 1, 2].map((i) => <li key={i} className="shimmer h-12 rounded-2xl" />)}
    </ul>
  );
}
