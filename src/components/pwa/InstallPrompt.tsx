"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

function shouldShow() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  return isIOS && !isStandalone;
}

/** iPhone has no install button, so tell iOS users how to add ORBIT. */
export function InstallPrompt() {
  const show = useSyncExternalStore(noopSubscribe, shouldShow, () => false);

  if (!show) return null;

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-line bg-surface p-4 text-sm text-muted">
      Install ORBIT: tap <span className="text-fg">Share</span> then{" "}
      <span className="text-fg">Add to Home Screen</span>.
    </div>
  );
}
