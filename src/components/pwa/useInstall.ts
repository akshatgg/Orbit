"use client";

import { useSyncExternalStore } from "react";
import {
  closeGuide, dismiss, getServerSnapshot, getSnapshot, openGuide, promptInstall, subscribe,
} from "./install-store";

export type { PromptOutcome } from "./install-store";

/** Install state and actions. Safe on the server: everything reports "nothing to install". */
export function useInstall() {
  const s = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    platform: s.platform,
    isIPad: s.isIPad,
    ready: s.ready,
    installed: s.installed,
    canPromptNative: s.canPromptNative,
    bannerDue: s.bannerDue,
    guideOpen: s.guideOpen,
    promptInstall,
    dismiss,
    openGuide,
    closeGuide,
  };
}
