"use client";

import { DownloadIcon } from "./icons";
import { useInstallAction } from "./InstallButton";
import { useInstall } from "./useInstall";
import { useState } from "react";

/** "Get the app" row for Profile. Renders nothing when installed or unsupported. */
export function InstallRow() {
  const action = useInstallAction();
  const { platform } = useInstall();
  const [tip, setTip] = useState(false);
  if (!action) return null;
  const isTip = action.kind === "mac-tip";
  return (
    <div className="mx-4">
      <button
        type="button"
        onClick={() => (isTip ? setTip((v) => !v) : action.run())}
        aria-expanded={isTip ? tip : undefined}
        className="group glass flex w-full items-center gap-4 rounded-[22px] p-4 text-left transition duration-200 hover:bg-ink/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <span aria-hidden className="bg-gradient flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] text-bg">
          <DownloadIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold tracking-tight">Get the app</span>
          <span className="block text-sm text-muted">
            {platform.startsWith("ios-") ? "Add ORBIT to your Home Screen." : "Install ORBIT for quick, full-screen access."}
          </span>
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {isTip && tip && (
        <p role="status" className="px-2 pt-2 text-xs text-muted">
          In Safari, choose <b className="text-fg">File → Add to Dock…</b>
        </p>
      )}
    </div>
  );
}
