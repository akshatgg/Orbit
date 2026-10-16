"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { DownloadIcon } from "./icons";
import { useInstall } from "./useInstall";

type Props = {
  /** "pill" is the pearl button; "link" is a quiet text link for secondary spots. */
  variant?: "pill" | "link";
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
};

/** Everything the platform can offer, or null when there's nothing to offer. */
export function useInstallAction() {
  const { platform, installed, ready, canPromptNative, promptInstall, openGuide } = useInstall();
  if (!ready || installed) return null;
  if (canPromptNative) return { kind: "native" as const, run: () => void promptInstall() };
  if (platform.startsWith("ios-")) return { kind: "guide" as const, run: openGuide };
  if (platform === "macos-safari") return { kind: "mac-tip" as const, run: () => {} };
  return null;
}

export function InstallButton({ variant = "pill", size = "md", className = "", label = "Install ORBIT" }: Props) {
  const action = useInstallAction();
  const [tip, setTip] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!tip) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setTip(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTip(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [tip]);

  if (!action) return null;

  const cls =
    variant === "pill"
      ? buttonClass({ variant: "primary", size, className })
      : `inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-medium text-muted underline-offset-4 transition duration-200 hover:text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none ${className}`;

  const isTip = action.kind === "mac-tip";
  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        type="button"
        className={cls}
        aria-haspopup={isTip ? "true" : action.kind === "guide" ? "dialog" : undefined}
        aria-expanded={isTip ? tip : undefined}
        onClick={() => (isTip ? setTip((v) => !v) : action.run())}
      >
        <DownloadIcon className="h-4 w-4" />
        {label}
      </button>
      {isTip && tip && (
        <span
          role="status"
          className="glass-strong absolute left-1/2 top-full z-40 mt-2 w-60 -translate-x-1/2 rounded-2xl p-3 text-left text-xs leading-relaxed text-muted"
        >
          In Safari, choose <b className="text-fg">File → Add to Dock…</b> to install ORBIT as an app.
        </span>
      )}
    </span>
  );
}
