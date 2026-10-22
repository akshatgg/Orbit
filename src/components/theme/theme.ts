// Pure theme logic shared by the inline pre-paint script, the hook and the tests.
//
// Until someone picks Light or Dark, the theme is automatic by time of day on their device: light in
// the daytime, dark at night. ("system" is that automatic choice; the stored value keeps its old
// name so saved preferences carry over.)

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "orbit-theme";
export const THEME_COLORS: Record<ResolvedTheme, string> = { dark: "#0c0d10", light: "#f3f4f7" };

/** Daytime (light theme) runs from DAY_START_HOUR to NIGHT_START_HOUR, local time. */
export const DAY_START_HOUR = 7;
export const NIGHT_START_HOUR = 19;

export function isDaytime(hour: number): boolean {
  return hour >= DAY_START_HOUR && hour < NIGHT_START_HOUR;
}

export function parsePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** The theme to paint: an explicit choice wins; automatic is light by day and dark at night. */
export function resolveTheme(preference: ThemePreference, hour: number): ResolvedTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return isDaytime(hour) ? "light" : "dark";
}

/** Milliseconds from `now` to the next switch between day and night (7:00 or 19:00 local time). */
export function msUntilNextSwitch(now: Date): number {
  const next = new Date(now);
  const hour = now.getHours();
  if (hour < DAY_START_HOUR) next.setHours(DAY_START_HOUR, 0, 0, 0);
  else if (hour < NIGHT_START_HOUR) next.setHours(NIGHT_START_HOUR, 0, 0, 0);
  else { next.setDate(next.getDate() + 1); next.setHours(DAY_START_HOUR, 0, 0, 0); }
  return next.getTime() - now.getTime();
}

/** What the header toggle does: flip to the opposite of what is on screen (always an explicit choice). */
export function toggledPreference(resolved: ResolvedTheme): ThemePreference {
  return resolved === "dark" ? "light" : "dark";
}

/**
 * Runs before first paint (beforeInteractive). Keep it dependency free: it is serialised into the page.
 * Also exposes window.__orbitTheme(pref) so the client hook applies changes through the same code.
 * On automatic it switches by itself at 7:00 and 19:00, and re-checks when the tab comes back.
 */
export const THEME_SCRIPT = `(function () {
  var KEY = ${JSON.stringify(THEME_STORAGE_KEY)};
  var COLORS = ${JSON.stringify(THEME_COLORS)};
  var DAY = ${DAY_START_HOUR}, NIGHT = ${NIGHT_START_HOUR};
  function isDay(h) { return h >= DAY && h < NIGHT; }
  // Same rule as msUntilNextSwitch.
  function until(now) {
    var next = new Date(now), h = now.getHours();
    if (h < DAY) next.setHours(DAY, 0, 0, 0);
    else if (h < NIGHT) next.setHours(NIGHT, 0, 0, 0);
    else { next.setDate(next.getDate() + 1); next.setHours(DAY, 0, 0, 0); }
    return next.getTime() - now.getTime();
  }
  var timer = 0;
  function read() {
    try { var v = localStorage.getItem(KEY); if (v === 'light' || v === 'dark' || v === 'system') return v; } catch (e) {}
    return 'system';
  }
  function apply(pref) {
    var theme = pref === 'system' ? (isDay(new Date().getHours()) ? 'light' : 'dark') : pref;
    var root = document.documentElement;
    if (root.getAttribute('data-theme') !== theme) {
      root.setAttribute('data-theme', theme);
      root.style.colorScheme = theme;
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', COLORS[theme]);
      try { window.dispatchEvent(new Event('orbit-theme')); } catch (e) {}
    }
    clearTimeout(timer);
    if (pref === 'system') timer = setTimeout(function () { apply(read()); }, until(new Date()) + 1000);
    return theme;
  }
  window.__orbitTheme = function (pref) {
    try { localStorage.setItem(KEY, pref); } catch (e) {}
    return apply(pref);
  };
  apply(read());
  document.addEventListener('visibilitychange', function () { if (!document.hidden) apply(read()); });
})();`;
