"use client";

import {
  isBannerDue, readSignals, recordDismissal, recordMoment, recordVisit,
} from "@/lib/pwa/dismissal";
import { detectPlatform, type PlatformInfo } from "@/lib/pwa/detect";

/** The deferred `beforeinstallprompt` event, captured early by the inline script in the root layout. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __orbitInstall?: { event: BeforeInstallPromptEvent | null; installed: boolean };
  }
  interface Navigator {
    standalone?: boolean;
    getInstalledRelatedApps?: () => Promise<unknown[]>;
  }
}

/** Runs before hydration: keeps the event (otherwise it fires before React mounts) and tells us when it is used. */
export const INSTALL_CAPTURE_SCRIPT = `(function(){var s=window.__orbitInstall=window.__orbitInstall||{event:null,installed:false};function n(){window.dispatchEvent(new Event('orbit:install-change'))}window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();s.event=e;n()});window.addEventListener('appinstalled',function(){s.event=null;s.installed=true;n()})})();`;

export type InstallSnapshot = PlatformInfo & {
  ready: boolean;
  installed: boolean;
  canPromptNative: boolean;
  bannerDue: boolean;
  guideOpen: boolean;
};

const SERVER: InstallSnapshot = {
  platform: "unsupported", isIPad: false, ready: false, installed: false,
  canPromptNative: false, bannerDue: false, guideOpen: false,
};

let snapshot: InstallSnapshot = SERVER;
let initialised = false;
let relatedAppInstalled = false;
let dismissedThisPage = false;
let guideOpen = false;
const listeners = new Set<() => void>();

function safeStorage(kind: "localStorage" | "sessionStorage"): Storage | null {
  try {
    return window[kind];
  } catch {
    return null;
  }
}

function isStandalone(): boolean {
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      navigator.standalone === true
    );
  } catch {
    return false;
  }
}

function compute(): InstallSnapshot {
  const info = detectPlatform(navigator.userAgent, { maxTouchPoints: navigator.maxTouchPoints });
  const state = window.__orbitInstall;
  const installed = isStandalone() || relatedAppInstalled || !!state?.installed;
  const signals = readSignals(safeStorage("localStorage"));
  return {
    ...info,
    ready: true,
    installed,
    canPromptNative: !installed && !!state?.event,
    bannerDue: !dismissedThisPage && isBannerDue(signals, Date.now()),
    guideOpen,
  };
}

function emit() {
  snapshot = compute();
  listeners.forEach((l) => l());
}

function init() {
  if (initialised) return;
  initialised = true;
  recordVisit(safeStorage("localStorage"), safeStorage("sessionStorage"));
  window.addEventListener("orbit:install-change", emit);
  try {
    window.matchMedia("(display-mode: standalone)").addEventListener("change", emit);
  } catch {
    /* ignore */
  }
  // Best effort: only resolves for apps related through the manifest.
  navigator.getInstalledRelatedApps?.().then((apps) => {
    if (apps.length) {
      relatedAppInstalled = true;
      emit();
    }
  }, () => {});
  snapshot = compute();
}

export function subscribe(listener: () => void): () => void {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): InstallSnapshot {
  if (typeof window === "undefined") return SERVER;
  init();
  return snapshot;
}

export function getServerSnapshot(): InstallSnapshot {
  return SERVER;
}

export type PromptOutcome = "accepted" | "dismissed" | "unavailable";

export async function promptInstall(): Promise<PromptOutcome> {
  const state = window.__orbitInstall;
  const event = state?.event;
  if (!event) return "unavailable";
  // The event is single-use: drop it whatever the outcome.
  state.event = null;
  emit();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome;
  } catch {
    return "unavailable";
  }
}

/** Hide the banner for 14 days. */
export function dismiss(): void {
  dismissedThisPage = true;
  recordDismissal(safeStorage("localStorage"), Date.now());
  emit();
}

/** Call after a meaningful moment (saved an event, got a ticket) so the banner can appear. */
export function markInstallMoment(): void {
  if (typeof window === "undefined") return;
  recordMoment(safeStorage("localStorage"));
  if (initialised) emit();
}

export function openGuide(): void {
  guideOpen = true;
  emit();
}

export function closeGuide(): void {
  guideOpen = false;
  emit();
}
