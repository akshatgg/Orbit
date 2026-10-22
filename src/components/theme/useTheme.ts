"use client";

import { useCallback, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, parsePreference, resolveTheme, toggledPreference, type ResolvedTheme, type ThemePreference } from "./theme";

declare global {
  interface Window {
    __orbitTheme?: (preference: ThemePreference) => ResolvedTheme;
  }
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  // The pre-paint script fires this when automatic switches between day and night.
  window.addEventListener("orbit-theme", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
    window.removeEventListener("orbit-theme", onChange);
  };
}

function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

const serverPreference = (): ThemePreference => "system";
const serverResolved = (): ResolvedTheme => "dark";

function readResolved(): ResolvedTheme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "light" || attr === "dark") return attr;
  return resolveTheme(readPreference(), new Date().getHours());
}

/** Current theme preference ("system" = automatic by time of day | "light" | "dark"), what is on screen, and setters. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPreference, serverPreference);
  const resolved = useSyncExternalStore(subscribe, readResolved, serverResolved);

  const setPreference = useCallback((next: ThemePreference) => {
    if (window.__orbitTheme) window.__orbitTheme(next);
    else {
      try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* storage unavailable */ }
      document.documentElement.setAttribute("data-theme", resolveTheme(next, new Date().getHours()));
    }
    listeners.forEach((l) => l());
  }, []);

  const toggle = useCallback(() => setPreference(toggledPreference(readResolved())), [setPreference]);

  return { preference, resolved, setPreference, toggle };
}
