"use client";

import { CloseIcon } from "./icons";
import { InstallButton, useInstallAction } from "./InstallButton";
import { useInstall } from "./useInstall";

/** Slim, dismissible nudge. Sits in the page flow (never over the tab bar) and returns 14 days after dismissal. */
export function InstallBanner() {
  const { bannerDue, dismiss } = useInstall();
  const action = useInstallAction();
  // The macOS Safari tip is a popover; a banner would be pushy there.
  if (!bannerDue || !action || action.kind === "mac-tip") return null;

  return (
    <div role="region" aria-label="Install ORBIT" className="glass mx-4 mt-4 flex items-center gap-3 rounded-[22px] py-2.5 pl-4 pr-2">
      <p className="min-w-0 flex-1 text-sm text-muted">
        <span className="font-semibold text-fg">Get the app.</span> Faster, full screen, one tap away.
      </p>
      <InstallButton size="sm" label="Install" />
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss install suggestion"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-subtle transition duration-200 hover:bg-white/[0.06] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none"
      >
        <CloseIcon />
      </button>
    </div>
  );
}
