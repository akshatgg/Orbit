// The opening animation ("liquid dive"): coloured drops swirl and melt into the ORBIT logo, the
// wordmark wipes in, then the logo's dark centre opens onto the real page and the logo grows past
// the viewer. Runs from an inline <head> script before the page paints (see intro-script.ts), so
// runIntro is serialised with toString(): keep it fully self-contained (no imports, no closures
// over module scope) and use only plain DOM APIs.
//
// Smoothness: the page hydrates while this plays, so the main thread is busy. Every moving part is
// therefore a Web Animation on transform/opacity of an HTML element (run by the compositor), and the
// whole timeline is scheduled up front with delays — nothing waits on JavaScript between steps.

import type { IntroLogo } from "./logo-data";

export type IntroOptions = {
  emblemUrl: string;
  reducedMotion: boolean;
  /** Hard stop: the overlay is always gone after this many ms. */
  maxMs: number;
};

export function runIntro(LOGO: IntroLogo, opts: IntroOptions): void {
  const doc = document;
  const root = doc.documentElement;
  const NS = "http://www.w3.org/2000/svg";
  const BG = "#0c0d10";
  const OVERLAY_Z = "2147483647";

  // Timeline (ms from start).
  const SWIRL = 1350; // drops swirl in
  const FORM = SWIRL; // drops become the logo
  const WIPE = FORM + 350; // wordmark wipes in
  const DIVE = FORM + 1500; // centre opens, logo grows past the viewer
  const DIVE_MS = 1500;
  const END = DIVE + 100 + DIVE_MS;

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

  /** Quick fade-out then finish (skip, reduced motion). */
  function fadeOut(ms: number) {
    if (dead || !overlay) return finish();
    try {
      overlay.getAnimations({ subtree: true }).forEach((a) => a.pause());
      const a = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease-out", fill: "forwards" });
      a.onfinish = finish;
    } catch {
      finish();
      return;
    }
    later(ms + 120, finish);
  }

  const svgEl = (tag: string, attrs?: Record<string, string>) => {
    const e = doc.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const div = (css: string) => {
    const e = doc.createElement("div");
    e.style.cssText = css;
    return e;
  };
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const polar = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };
  const corePoints = (scale: number) =>
    LOGO.core
      .split(" ")
      .map((pt) => pt.split(",").map((v) => (parseFloat(v) * scale).toFixed(1)).join(","))
      .join(" ");

  try {
    later(opts.maxMs, finish);

    const W = window.innerWidth;
    const H = window.innerHeight;
    const CX = W / 2;
    const CY = H * 0.46;
    // Size the logo from a phone-sized base so it stays the same comfortable size on laptops.
    const B = Math.min(W, H * 0.62, 420);
    const k = (B * 0.19) / 100; // px per logo unit (logo radius = 100 units)
    // Zoom far enough that the logo's centre (narrowest at ~38% of the radius) covers the screen.
    const zMax = (Math.hypot(W, H) / 2 / (38 * k)) * 1.2;
    const full = "position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible;";
    const origin = `transform-origin:${CX}px ${CY}px;`;

    const ov = div(
      `position:fixed;inset:0;z-index:${OVERLAY_Z};overflow:hidden;pointer-events:auto;touch-action:none;` +
        "font-family:var(--font-instrument),system-ui,sans-serif;color:#f2f3f5;contain:strict;",
    );
    ov.setAttribute("aria-hidden", "true");
    overlay = ov;

    // ---- Zoom layer: dark backdrop with a hole shaped like the logo's centre, the centre's dark
    // fill, the glow and the logo. The whole layer grows at the end (one composited transform).
    const zoomWrap = div(full + origin + "will-change:transform;");
    ov.appendChild(zoomWrap);
    const view = `${-CX / k} ${-CY / k} ${W / k} ${H / k}`; // logo units, logo centred at (CX, CY)

    const darkSvg = svgEl("svg", { viewBox: view, preserveAspectRatio: "none" });
    darkSvg.style.cssText = full;
    const mask = svgEl("mask", { id: "orbit-intro-mask", maskUnits: "userSpaceOnUse", x: "-9000", y: "-9000", width: "18000", height: "18000" });
    mask.appendChild(svgEl("rect", { x: "-9000", y: "-9000", width: "18000", height: "18000", fill: "#fff" }));
    mask.appendChild(svgEl("polygon", { points: corePoints(1), fill: "#000" }));
    darkSvg.appendChild(mask);
    darkSvg.appendChild(svgEl("rect", { x: "-9000", y: "-9000", width: "18000", height: "18000", fill: BG, mask: "url(#orbit-intro-mask)" }));
    zoomWrap.appendChild(darkSvg);

    const coreWrap = div(full + "will-change:opacity;");
    const coreSvg = svgEl("svg", { viewBox: view, preserveAspectRatio: "none" });
    coreSvg.style.cssText = full;
    coreSvg.appendChild(svgEl("polygon", { points: corePoints(1.01), fill: BG }));
    coreWrap.appendChild(coreSvg);
    zoomWrap.appendChild(coreWrap);

    const glowSize = 300 * k;
    const glow = div(
      `position:absolute;left:${CX - glowSize / 2}px;top:${CY - glowSize / 2}px;width:${glowSize}px;height:${glowSize}px;border-radius:50%;` +
        "background:radial-gradient(circle,rgba(181,124,246,.75) 0,rgba(63,121,253,.32) 45%,rgba(63,121,253,0) 70%);opacity:0;will-change:opacity,transform;",
    );
    zoomWrap.appendChild(glow);

    const logoWrap = div(full + origin + "opacity:0;will-change:opacity,transform;");
    const logoSvg = svgEl("svg", { viewBox: view, preserveAspectRatio: "none" });
    logoSvg.style.cssText = full;
    const defs = svgEl("defs");
    const soft = svgEl("filter", { id: "orbit-intro-s", x: "-30%", y: "-30%", width: "160%", height: "160%" });
    soft.appendChild(svgEl("feGaussianBlur", { stdDeviation: "4", in: "SourceGraphic", result: "b" }));
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "b" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    soft.appendChild(merge);
    defs.appendChild(soft);
    logoSvg.appendChild(defs);
    const group = svgEl("g", { filter: "url(#orbit-intro-s)" });
    LOGO.petals.forEach((pc, i) => {
      const clip = svgEl("clipPath", { id: `orbit-intro-c${i}` });
      clip.appendChild(svgEl("path", { d: pc.d }));
      defs.appendChild(clip);
      group.appendChild(
        svgEl("image", {
          href: opts.emblemUrl, x: String(LOGO.img.x), y: String(LOGO.img.y), width: String(LOGO.img.w), height: String(LOGO.img.w),
          "clip-path": `url(#orbit-intro-c${i})`, preserveAspectRatio: "none",
        }),
      );
    });
    logoSvg.appendChild(group);
    logoWrap.appendChild(logoSvg);
    zoomWrap.appendChild(logoWrap);

    // ---- Wordmark below the logo, in the app's font.
    const u = B / 100;
    const wm = div(`position:absolute;left:0;right:0;top:${CY + B * 0.3}px;text-align:center;opacity:0;will-change:opacity,transform;`);
    wm.innerHTML =
      `<div style="font-weight:600;font-size:${u * 7.6}px;letter-spacing:.38em;padding-left:.38em;line-height:1;white-space:nowrap">ORBIT</div>` +
      `<div style="margin-top:${u * 3}px;font-size:${u * 3.3}px;letter-spacing:.32em;padding-left:.32em;color:#a9a3c9;white-space:nowrap">EXPLORE OPPORTUNITIES</div>`;
    ov.appendChild(wm);

    // ---- Drops: soft blurred circles in the logo's colours, each on its own composited layer; they
    // end overlapping, so their soft edges run together (a smooth stand-in for a goo filter).
    const size = B * 0.38;
    const dropsWrap = div(`position:absolute;left:${CX}px;top:${CY}px;width:0;height:0;will-change:opacity;`);
    ov.appendChild(dropsWrap);
    const fills = ["#4a6dff", "#ffad66", "#9d8cff", "#f1dccb", "#b77cff"];
    const drop = size * 0.5;
    const drops = fills.map((c, i) => {
      const d = div(
        `position:absolute;left:${-drop / 2}px;top:${-drop / 2}px;width:${drop}px;height:${drop}px;border-radius:50%;` +
          `background:radial-gradient(circle at 35% 35%,#fff 0 8%,${c} 45%,${c});filter:blur(${Math.max(2, drop * 0.09)}px);will-change:transform;`,
      );
      dropsWrap.appendChild(d);
      const mid = LOGO.petals[i].mid;
      return { d, a0: mid + 200 + Math.random() * 60, r0: size * (1.15 + Math.random() * 0.4), a1: mid, r1: size * 0.21 };
    });

    root.appendChild(ov);
    // The overlay is in place: the CSS cover is no longer needed.
    root.setAttribute("data-intro", "playing");

    // Skip: any tap, click or key ends it with a quick fade.
    const skip = () => fadeOut(250);
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    cleanups.push(() => {
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
    });

    const img = new Image();
    img.onerror = () => fadeOut(200); // never leave the page covered

    // ---- Reduced motion: static logo + wordmark, then a short fade.
    if (opts.reducedMotion) {
      logoWrap.style.opacity = "1";
      glow.style.opacity = ".6";
      wm.style.opacity = "1";
      dropsWrap.style.display = "none";
      img.onload = () => later(700, () => fadeOut(250));
      img.src = opts.emblemUrl;
      return;
    }
    img.src = opts.emblemUrl;

    const both = "both" as FillMode;
    // 1) Drops swirl in along a spiral (ease-out baked into the keyframes, so the path stays smooth).
    const STEPS = 30;
    drops.forEach((it) => {
      const frames: Keyframe[] = [];
      for (let s = 0; s <= STEPS; s++) {
        const t = easeOut(s / STEPS);
        const p = polar(lerp(it.r0, it.r1, t), lerp(it.a0, it.a1, t));
        frames.push({ transform: `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) scale(${lerp(0.55, 1.1, t).toFixed(3)})` });
      }
      it.d.animate(frames, { duration: SWIRL, easing: "linear", fill: both });
    });
    dropsWrap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250, fill: both });

    // 2) The drops melt away as the real logo forms; glow pulse; wordmark wipes in.
    dropsWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, delay: FORM, fill: "forwards" });
    logoWrap.animate(
      [{ opacity: 0, transform: "scale(.88)" }, { opacity: 1, transform: "scale(1)" }],
      { duration: 620, delay: FORM, easing: "cubic-bezier(.22,1,.36,1)", fill: both },
    );
    glow.animate(
      [{ opacity: 0, transform: "scale(.6)" }, { opacity: 0.85, transform: "scale(1.2)" }, { opacity: 0.6, transform: "scale(1)" }],
      { duration: 900, delay: FORM + 120, fill: both },
    );
    wm.animate(
      [{ opacity: 1, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)" }],
      { duration: 750, delay: WIPE, easing: "cubic-bezier(.6,0,.2,1)", fill: both },
    );

    // 3) The centre opens onto the page and the whole logo grows past the viewer.
    coreWrap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, delay: DIVE, easing: "linear", fill: "forwards" });
    glow.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 500, delay: DIVE, fill: "forwards", composite: "replace" });
    wm.animate(
      [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(60px) scale(1.8)" }],
      { duration: 750, delay: DIVE, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" },
    );
    const dive = zoomWrap.animate(
      [{ transform: "scale(1) rotate(0deg)" }, { transform: `scale(${zMax.toFixed(2)}) rotate(28deg)` }],
      { duration: DIVE_MS, delay: DIVE + 100, easing: "cubic-bezier(.55,.055,.675,.19)", fill: "forwards" },
    );
    dive.onfinish = finish;
    later(END + 400, finish);
  } catch {
    finish();
  }
}
