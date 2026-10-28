"use client";

import { useSyncExternalStore } from "react";

/**
 * Unread counts for the nav (bell + messages), shared by every badge on the page.
 *
 * One poll for the whole tab, however many badges are mounted (the phone top bar and the desktop
 * header both render): every 30 s while the tab is visible, and straight away when it comes back
 * into view or when `refreshBadges()` is called after an action.
 */

export type Badges = { notifications: number; messages: number; signedOut?: boolean };

const POLL_MS = 30_000;
const EMPTY: Badges = { notifications: 0, messages: 0 };

let state: Badges = EMPTY;
let timer: ReturnType<typeof setInterval> | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit(next: Badges) {
  if (next.notifications === state.notifications && next.messages === state.messages && next.signedOut === state.signedOut) return;
  state = next;
  listeners.forEach((listener) => listener());
}

async function load() {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch("/api/social/badges", { cache: "no-store", headers: { accept: "application/json" } });
      if (response.status === 401) return emit({ ...EMPTY, signedOut: true });
      if (!response.ok || !response.headers.get("content-type")?.includes("json")) return;
      const data = (await response.json()) as Partial<Badges>;
      emit({ notifications: Number(data.notifications) || 0, messages: Number(data.messages) || 0 });
    } catch {
      // Offline or the API is down: keep the last counts.
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

const onVisible = () => {
  if (document.visibilityState === "visible") void load();
};

function start() {
  void load();
  timer = setInterval(() => {
    if (document.visibilityState === "visible") void load();
  }, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop();
  };
}

/** Re-reads the counts now (after marking something read, accepting an invite, opening a thread). */
export function refreshBadges() {
  void load();
}

/** Sets a count locally before the next poll confirms it. */
export function setBadge(key: keyof Omit<Badges, "signedOut">, value: number) {
  emit({ ...state, [key]: Math.max(0, value) });
}

export function useBadges(): Badges {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}
