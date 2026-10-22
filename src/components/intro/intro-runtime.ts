// The opening animation: the ORBIT logo fades in and settles, gives one soft beat, and two faint
// rings ripple out from it like a signal going out; then the screen fades into the app. Logo only,
// about two seconds, on the app's own background (dark or light). The logo is never filtered, so it
// keeps its full colours in both themes.
//
// Runs from an inline <head> script before the page paints (see intro-script.ts), so runIntro is
// serialised with toString(): keep it fully self-contained (no imports, no closures over module
// scope) and use only plain DOM APIs.
//
// Smoothness: the page hydrates while this plays, so the main thread is busy. Every moving part is
// a Web Animation on transform/opacity (run by the compositor), scheduled up front with delays —
// nothing waits on JavaScript between steps. The timeline only starts once the logo image is ready;
// if it isn't within a short wait (a very slow first load), the intro is skipped rather than playing
// around an empty space.

export type IntroOptions = {
  /** The logo shown in the middle of the screen (small, so it's ready almost at once). */
  logoUrl: string;
  /** The theme the page is painted in, and each theme's background (THEME_COLORS). */
  theme: "light" | "dark";
  colors: { light: string; dark: string };
  reducedMotion: boolean;
  /** Opened from the home-screen icon: start from the OS launch-screen logo instead of an empty screen. */
  fromIcon?: boolean;
  /** Width in px of the logo on the launch screen (the cover draws it there until the overlay mounts). */
  launchLogoPx?: number;
  /** Hard stop: the overlay is always gone after this many ms. */
  maxMs: number;
};

export function runIntro(opts: IntroOptions): void {
  const doc = document;
  const root = doc.documentElement;
  const DARK = opts.colors.dark;
  const light = opts.theme === "light";
  const BG = light ? opts.colors.light : DARK;
  // Rings: pale lavender on dark; a deeper violet on light so they still show.
  const RING = light ? "rgba(108,92,231,.5)" : "rgba(200,190,255,.7)";
  const LOGO_PX = 96;
  const EASE = "cubic-bezier(.22,1,.36,1)"; // soft ease-out, no overshoot
  const READY_WAIT_MS = 1200; // longest we wait for the logo image; past that the intro is skipped

  // Timeline (ms from when the logo is ready).
  const IN_MS = 500; // logo fades in and settles
  const BEAT_AT = 550; // one soft beat…
  const BEAT_MS = 400;
  const RING_AT = [550, 800]; // …as two rings ripple out
  const RING_MS = 1200;
  const FADE_AT = 1800; // screen fades into the app
  const FADE_MS = 500;

  let dead = false;
  let overlay: HTMLElement | null = null;
  const timers: number[] = [];
  const cleanups: (() => void)[] = [];
  const later = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };

  /** Removes everything the intro added. Safe to call more than once. */
  function finish() {
    if (dead) return;
    dead = true;
    timers.forEach((t) => window.clearTimeout(t));
    cleanups.forEach((fn) => {
      try { fn(); } catch { /* ignore */ }
    });
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    const st = doc.getElementById("orbit-intro-style");
    if (st && st.parentNode) st.parentNode.removeChild(st);
    root.removeAttribute("data-intro");
  }

  /** Fades the whole screen out, then cleans up. */
  function fadeOut(ms: number) {
    if (dead || !overlay) return finish();
    try {
      const a = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease-out", fill: "forwards" });
      a.onfinish = finish;
    } catch {
      finish();
      return;
    }
    later(ms + 120, finish);
  }

  const el = (tag: string, css: string) => {
    const e = doc.createElement(tag);
    e.style.cssText = css;
    return e;
  };

  // From the home-screen icon the OS launch screen is dark, so start dark and ease into a light theme.
  const startBg = opts.fromIcon ? DARK : BG;
  overlay = el(
    "div",
    `position:fixed;inset:0;z-index:2147483647;background:${startBg};display:flex;align-items:center;justify-content:center;pointer-events:auto;`,
  );
  overlay.setAttribute("aria-hidden", "true");

  // The rings: thin circles the size of the logo, hidden until they ripple.
  const rings = RING_AT.map(() =>
    el(
      "div",
      `position:absolute;left:50%;top:50%;width:${LOGO_PX}px;height:${LOGO_PX}px;margin:${-LOGO_PX / 2}px 0 0 ${-LOGO_PX / 2}px;border-radius:50%;` +
        `border:2px solid ${RING};box-sizing:border-box;opacity:0;will-change:transform,opacity;`,
    ),
  );

  // Hidden until the timeline starts (unless continuing from the launch screen, where it's already shown).
  const fromIcon = !!opts.fromIcon && !!opts.launchLogoPx;
  const logo = el(
    "img",
    `position:relative;width:${LOGO_PX}px;height:${LOGO_PX}px;display:block;border-radius:50%;will-change:transform,opacity;` +
      (fromIcon ? `transform:scale(${opts.launchLogoPx! / LOGO_PX});` : "opacity:0;") +
      (light ? "box-shadow:0 14px 40px rgba(60,50,120,.18);" : ""),
  ) as HTMLImageElement;
  logo.alt = "";
  logo.src = opts.logoUrl;

  rings.forEach((ring) => overlay!.appendChild(ring));
  overlay.appendChild(logo);
  doc.body.appendChild(overlay);

  // Tap or key skips straight to the app.
  const skip = () => fadeOut(260);
  overlay.addEventListener("pointerdown", skip, { once: true });
  window.addEventListener("keydown", skip, { once: true });
  cleanups.push(() => window.removeEventListener("keydown", skip));
  later(opts.maxMs, finish);

  let begun = false;
  function begin() {
    if (begun || dead) return;
    begun = true;
    root.setAttribute("data-intro", "play"); // overlay and logo are ready: drop the pre-paint cover

    if (opts.reducedMotion) {
      logo.style.opacity = "1";
      later(800, () => fadeOut(300));
      return;
    }
    try {
      // Later steps animate the same properties, so only a step that starts at 0 fills backwards;
      // the rest only hold their end state (a backwards fill would override the step before them).
      const anim = (target: Element, frames: Keyframe[], duration: number, delay: number, easing: string) =>
        target.animate(frames, { duration, delay, easing, fill: delay === 0 ? "both" : "forwards" });

      if (startBg !== BG) anim(overlay!, [{ backgroundColor: startBg }, { backgroundColor: BG }], 600, 0, "ease-out");
      if (fromIcon) {
        anim(logo, [{ transform: `scale(${opts.launchLogoPx! / LOGO_PX})` }, { transform: "scale(1)" }], IN_MS, 0, EASE);
      } else {
        anim(logo, [{ opacity: 0, transform: "scale(.85)" }, { opacity: 1, transform: "scale(1)" }], IN_MS, 0, EASE);
      }

      // One soft beat while the rings ripple out and fade; then the screen fades into the app.
      anim(logo, [{ transform: "scale(1)" }, { transform: "scale(1.04)" }, { transform: "scale(1)" }], BEAT_MS, BEAT_AT, "ease-in-out");
      rings.forEach((ring, i) =>
        anim(ring, [{ opacity: 0.8, transform: "scale(1)" }, { opacity: 0, transform: "scale(3)" }], RING_MS, RING_AT[i], EASE),
      );
    } catch {
      // No Web Animations: the logo just shows, then fades out normally.
      logo.style.opacity = "1";
    }
    later(FADE_AT, () => fadeOut(FADE_MS));
  }

  // Start once the logo can be drawn (decoded). Still not there after the wait: skip to the app.
  later(READY_WAIT_MS, () => {
    if (begun) return;
    if (logo.complete && logo.naturalWidth > 0) begin();
    else {
      begun = true;
      root.setAttribute("data-intro", "play");
      fadeOut(300);
    }
  });
  try {
    const ready = logo.decode ? logo.decode() : null;
    if (ready) ready.then(begin, begin);
    else logo.addEventListener("load", begin, { once: true });
  } catch {
    begin();
  }
}
