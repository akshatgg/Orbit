"use client";

// Collapsible sidebar state, shared by the app sidebar and the admin sidebar.
//
// Two states: pinned (full width, the default) and collapsed (an icon rail). While collapsed the
// sidebar expands again on hover or keyboard focus and floats over the page, so the content never
// jumps around. The choice is remembered per sidebar in localStorage.

import { useCallback, useState, useSyncExternalStore, type FocusEvent } from "react";

export const SIDEBAR_STORAGE_KEY = "orbit-sidebar";

type Store = {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => boolean;
  getServerSnapshot: () => boolean;
  set: (pinned: boolean) => void;
};

function createStore(key: string): Store {
  let pinned = true;
  let ready = false;
  const listeners = new Set<() => void>();

  const read = () => {
    try {
      return window.localStorage.getItem(key) !== "collapsed";
    } catch {
      return pinned;
    }
  };
  const emit = () => listeners.forEach((listener) => listener());

  // localStorage only exists in the browser, so the first read happens on the client.
  const start = () => {
    if (ready || typeof window === "undefined") return;
    ready = true;
    pinned = read();
    window.addEventListener("storage", (event) => {
      if (event.key !== key) return;
      pinned = read();
      emit();
    });
  };

  return {
    subscribe(listener) {
      start();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      start();
      return pinned;
    },
    getServerSnapshot: () => true,
    set(next) {
      start();
      pinned = next;
      try {
        window.localStorage.setItem(key, next ? "expanded" : "collapsed");
      } catch {
        /* private mode — keep it for this page only */
      }
      emit();
    },
  };
}

const stores = new Map<string, Store>();

function storeFor(key: string) {
  let store = stores.get(key);
  if (!store) {
    store = createStore(key);
    stores.set(key, store);
  }
  return store;
}

export type SidebarHandlers = {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: (event: FocusEvent<HTMLElement>) => void;
};

/**
 * `pinned` is the remembered choice, `collapsed` is the rail, `expanded` is what to draw right now
 * (pinned, or a hovered/focused rail), and `overlay` marks the temporary hover expansion.
 */
export function useCollapsibleSidebar(key: string) {
  const store = storeFor(key);
  const pinned = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [hovered, setHovered] = useState(false);
  const collapsed = !pinned;
  const expanded = pinned || hovered;

  const toggle = useCallback(() => {
    setHovered(false);
    store.set(!pinned);
  }, [store, pinned]);

  // Only a collapsed rail reacts to hover/focus; a pinned sidebar is already open.
  const handlers: SidebarHandlers = collapsed
    ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => setHovered(true),
        onBlur: (event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHovered(false);
        },
      }
    : {};

  return { pinned, collapsed, expanded, overlay: collapsed && hovered, toggle, handlers };
}
