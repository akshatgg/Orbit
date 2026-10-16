"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { isIOSPlatform, sharePosition, type InstallPlatform } from "@/lib/pwa/detect";
import { ArrowIcon, PlusSquareIcon, ShareIcon } from "./icons";
import { useInstall } from "./useInstall";

const FOCUSABLE = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

const SHARE_WHERE: Record<string, string> = {
  "ios-safari": "Tap the Share button in Safari's toolbar",
  "ios-chrome": "Tap the Share icon at the top right of the address bar",
  "ios-edge": "Tap the Share icon at the top right of the address bar",
  "ios-firefox": "Tap the Share icon in the address bar (or the menu, then Share)",
};

function shareStep(platform: InstallPlatform, isIPad: boolean): string {
  if (platform === "ios-safari" && isIPad) return "Tap the Share button at the top right of Safari";
  return SHARE_WHERE[platform] ?? "Tap Share";
}

export function InstallGuideSheet() {
  const { guideOpen, platform, isIPad, closeGuide } = useInstall();
  const open = guideOpen && isIOSPlatform(platform);
  if (!open) return null;
  return <Sheet platform={platform} isIPad={isIPad} onClose={closeGuide} />;
}

function Sheet({ platform, isIPad, onClose }: { platform: InstallPlatform; isIPad: boolean; onClose: () => void }) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const position = sharePosition({ platform, isIPad });

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const scrollLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    doneRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scrollLock;
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70]">
      <div aria-hidden className="install-fade absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      {position === "top-right" && (
        <div aria-hidden style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }} className="pointer-events-none absolute right-3 flex flex-col items-center text-accent">
          <span className="relative flex h-11 w-11 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent/30 motion-reduce:animate-none" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full border border-accent/50 bg-bg/80 text-fg">
              <ShareIcon className="h-5 w-5" />
            </span>
          </span>
          <ArrowIcon className="-mt-0.5 h-8 w-8 rotate-180 animate-bounce motion-reduce:animate-none" />
        </div>
      )}

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="install-sheet-up glass-strong absolute inset-x-0 bottom-0 mx-auto max-w-md rounded-t-[28px] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink/20" />
        <h2 id={titleId} className="font-display text-xl font-semibold tracking-tight">Add ORBIT to your Home Screen</h2>
        <p id={descId} className="mt-1 text-sm text-muted">Open it like an app, full screen, with one tap.</p>

        <ol className="mt-5 space-y-3">
          <Step n={1} icon={<ShareIcon />} text={shareStep(platform, isIPad)} />
          <Step n={2} icon={<PlusSquareIcon />} text={<>Scroll and choose <b className="text-fg">Add to Home Screen</b></>} />
          <Step n={3} icon={<span className="text-sm font-semibold">Add</span>} text={<>Tap <b className="text-fg">Add</b> in the top right corner</>} />
        </ol>

        {position === "bottom" && (
          <div aria-hidden className="mt-4 flex flex-col items-center text-accent">
            <ArrowIcon className="h-7 w-7 animate-bounce motion-reduce:animate-none" />
            <span className="text-xs font-medium text-muted">Share is in the bar below</span>
          </div>
        )}

        <button
          ref={doneRef}
          type="button"
          onClick={onClose}
          className="bg-gradient mt-5 h-12 w-full rounded-full text-[15px] font-semibold text-bg transition duration-200 hover:brightness-95 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: ReactNode; text: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 rounded-[18px] border border-ink/[0.07] bg-ink/[0.04] p-3">
      <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-ink/10 bg-ink/[0.06] text-accent">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-sm text-muted">
        <span className="mr-1.5 font-semibold text-fg">{n}.</span>
        {text}
      </span>
    </li>
  );
}
