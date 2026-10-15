"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";

/** Copies the public event link; falls back to the native share sheet when clipboard access fails. */
export function CopyLinkButton({ path, title, className = "" }: { path: string; title: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const url = new URL(path, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      try {
        if (!navigator.share) throw new Error("no share");
        await navigator.share({ title, url });
        setState("idle");
        return;
      } catch {
        setState("failed");
      }
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <button type="button" onClick={copy} className={buttonClass({ variant: "secondary", className })}>
      <LinkIcon />
      <span aria-live="polite">{state === "copied" ? "Link copied" : state === "failed" ? "Couldn't copy" : "Copy link"}</span>
    </button>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" strokeLinecap="round" />
      <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" strokeLinecap="round" />
    </svg>
  );
}
