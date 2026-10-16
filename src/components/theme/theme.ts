// Pure theme logic shared by the inline pre-paint script, the hook and the tests.

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "orbit-theme";
export const THEME_COLORS: Record<ResolvedTheme, string> = { dark: "#0c0d10", light: "#f3f4f7" };

export function parsePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** The theme to paint: an explicit choice wins, "system" follows the OS. */
export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemPrefersDark ? "dark" : "light";
}

/** What the header toggle does: flip to the opposite of what is on screen (always an explicit choice). */
export function toggledPreference(resolved: ResolvedTheme): ThemePreference {
  return resolved === "dark" ? "light" : "dark";
}

/**
 * Runs before first paint (beforeInteractive). Keep it dependency free: it is serialised into the page.
 * Also exposes window.__orbitTheme(pref) so the client hook applies changes through the same code.
 */
export const THEME_SCRIPT = `(function () {
  var KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  var COLORS = ${JSON.stringify(THEME_COLORS)};
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function read() {
    try { var v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark' || v === 'system') return v; } catch (e) {}
    return 'system';
  }
  function apply(pref) {
    var theme = pref === 'system' ? (mq.matches ? 'dark' : 'light') : pref;
    var root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', COLORS[theme]);
    return theme;
  }
  window.__orbitTheme = function (pref) {
    try { localStorage.setItem(KEY, pref); } catch (e) {}
    return apply(pref);
  };
  apply(read());
  var onChange = function () { if (read() === 'system') apply('system'); };
  if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
})();`;
