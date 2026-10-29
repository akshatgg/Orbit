"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { SocialIcon } from "./icons";

/** Shares a page of ORBIT: the device's share sheet where there is one, else copies the link. No API call. */
export function ShareLinkButton({ path, title, text, size = "sm" }: { path: string; title: string; text?: string; size?: "sm" | "md" }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        // Dismissed: done. Refused (no permission): copy instead.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", url);
    }
  }

  return (
    <button type="button" onClick={share} className={buttonClass({ variant: "secondary", size })}>
      <SocialIcon name={copied ? "check" : "share"} className="h-4 w-4" />
      <span aria-live="polite">{copied ? "Link copied" : "Share"}</span>
    </button>
  );
}
