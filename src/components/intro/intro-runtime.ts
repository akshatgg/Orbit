// The opening animation: the ORBIT logo fades in and settles, gives one soft beat, and two faint
// rings ripple out from it like a signal going out; then the screen fades into the app. Logo only,
// about two seconds.
//
// Runs from an inline <head> script before the page paints (see intro-script.ts), so runIntro is
// serialised with toString(): keep it fully self-contained (no imports, no closures over module
// scope) and use only plain DOM APIs.
//
// Smoothness: the page hydrates while this plays, so the main thread is busy. Every moving part is
// a Web Animation on transform/opacity/filter (run by the compositor), scheduled up front with
// delays — nothing waits on JavaScript between steps.

export type IntroOptions = {
  /** Transparent logo shown in the middle of the screen. */
  logoUrl: string;
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
  const BG = "#0c0d10";
  const LOGO_PX = 96;
  const EASE = "cubic-bezier(.22,1,.36,1)"; // soft ease-out, no overshoot

  // Timeline (ms from start).
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

  overlay = el(
    "div",
    `position:fixed;inset:0;z-index:2147483647;background:${BG};display:flex;align-items:center;justify-content:center;pointer-events:auto;`,
  );
  overlay.setAttribute("aria-hidden", "true");

  // The rings: thin, faint lavender circles the size of the logo, hidden until they ripple.
  const rings = RING_AT.map(() =>
    el(
      "div",
      `position:absolute;left:50%;top:50%;width:${LOGO_PX}px;height:${LOGO_PX}px;margin:${-LOGO_PX / 2}px 0 0 ${-LOGO_PX / 2}px;border-radius:50%;` +
        "border:2px solid rgba(200,190,255,.7);box-sizing:border-box;opacity:0;will-change:transform,opacity;",
    ),
  );

  const logo = el("img", `position:relative;width:${LOGO_PX}px;height:${LOGO_PX}px;display:block;will-change:transform,opacity,filter;`) as HTMLImageElement;
  logo.src = opts.logoUrl;
  logo.alt = "";
  logo.decoding = "async";

  rings.forEach((ring) => overlay!.appendChild(ring));
  overlay.appendChild(logo);
  doc.body.appendChild(overlay);
  root.setAttribute("data-intro", "play"); // overlay is up: drop the pre-paint cover

  // Tap or key skips straight to the app.
  const skip = () => fadeOut(260);
  overlay.addEventListener("pointerdown", skip, { once: true });
  window.addEventListener("keydown", skip, { once: true });
  cleanups.push(() => window.removeEventListener("keydown", skip));
  later(opts.maxMs, finish);

  if (opts.reducedMotion) {
    later(800, () => fadeOut(300));
    return;
  }

  try {
    // From the home-screen icon the OS launch screen already shows the logo (launchLogoPx wide, in
    // colour) in the middle: start from exactly that instead of popping in.
    const fromIcon = !!opts.fromIcon && !!opts.launchLogoPx;
    // Later steps animate the same properties, so only a step that starts at 0 fills backwards;
    // the rest only hold their end state (a backwards fill would override the step before them).
    const anim = (target: Element, frames: Keyframe[], duration: number, delay: number, easing: string) =>
      target.animate(frames, { duration, delay, easing, fill: delay === 0 ? "both" : "forwards" });

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
  }

  later(FADE_AT, () => fadeOut(FADE_MS));
}
