// The opening animation ("liquid dive"): coloured drops swirl and melt into the ORBIT logo, the
// wordmark wipes in, then the logo's dark centre opens onto the real page and the logo grows past
// the viewer. Runs from an inline head script before hydration (see intro-script.ts), so
// runIntro is serialised with toString(): keep it fully self-contained (no imports, no closures
// over module scope) and use only plain DOM APIs.

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
  const R = 100;
  const OVERLAY_Z = "2147483647";

  let dead = false;
  let overlay: HTMLElement | null = null;
  const timers: number[] = [];
  const cleanups: (() => void)[] = [];

  const later = (ms: number, fn: () => void) => {
    timers.push(window.setTimeout(fn, ms));
  };
  const wait = (ms: number) => new Promise<void>((res) => later(ms, res));

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

  /** Quick fade-out then finish (skip, reduced motion, image failure). */
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

  const svgEl = (tag: string, attrs?: Record<string, string>) => {
    const e = doc.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };
  const div = (cls: string, html?: string) => {
    const e = doc.createElement("div");
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  };

  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const polar = (r: number, deg: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: r * Math.cos(a), y: r * Math.sin(a) };
  };

  function tween(ms: number, fn: (e: number) => void, ease: (t: number) => number, delay?: number): Promise<void> {
    return new Promise<void>((res) => {
      later(delay || 0, () => {
        if (dead) return res();
        const s = performance.now();
        const step = (now: number) => {
          if (dead) return res();
          const t = Math.min(1, (now - s) / ms);
          fn(ease(t));
          if (t < 1) requestAnimationFrame(step);
          else res();
        };
        requestAnimationFrame(step);
      });
    });
  }

  const corePoints = (scale: number) =>
    LOGO.core
      .split(" ")
      .map((pt) => pt.split(",").map((v) => (parseFloat(v) * scale).toFixed(1)).join(","))
      .join(" ");

  function mount() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const CY = H * 0.46;
    // Size the logo from a phone-sized base so it stays the same comfortable size on laptops.
    const B = Math.min(W, H * 0.62, 420);

    const style = doc.getElementById("orbit-intro-style");
    const ov = div("oi-root");
    overlay = ov;
    ov.setAttribute("aria-hidden", "true");
    ov.style.setProperty("--u", B / 100 + "px");
    ov.style.cssText +=
      `position:fixed;inset:0;z-index:${OVERLAY_Z};background:${BG};overflow:hidden;pointer-events:auto;touch-action:none;` +
      "font-family:var(--font-instrument),system-ui,sans-serif;color:#f2f3f5;";

    // Styles for the wordmark and drops (kept next to the cover rule, removed with it).
    if (style) {
      style.appendChild(
        doc.createTextNode(
          ".oi-root .oi-wm{text-align:center}" +
            ".oi-root .oi-word{font-weight:600;font-size:calc(var(--u)*7.6);letter-spacing:.38em;padding-left:.38em;line-height:1;white-space:nowrap}" +
            ".oi-root .oi-word span{display:inline-block}" +
            ".oi-root .oi-tag{margin-top:calc(var(--u)*3);font-size:calc(var(--u)*3.3);letter-spacing:.32em;padding-left:.32em;color:#a9a3c9;white-space:nowrap}" +
            ".oi-root .oi-blobs{position:absolute;aspect-ratio:1;translate:-50% -50%;filter:url(#orbit-intro-goo)}" +
            ".oi-root .oi-blob{position:absolute;left:50%;top:50%;width:44%;aspect-ratio:1;margin:-22% 0 0 -22%;border-radius:50%}" +
            ".oi-root .oi-glow{transform-box:fill-box;transform-origin:center;opacity:0}",
        ),
      );
    }

    // The gooey filter the drops melt through.
    const defsSvg = svgEl("svg", { width: "0", height: "0" });
    defsSvg.style.cssText = "position:absolute";
    const goo = svgEl("filter", { id: "orbit-intro-goo" });
    goo.appendChild(svgEl("feGaussianBlur", { in: "SourceGraphic", stdDeviation: "9", result: "b" }));
    goo.appendChild(svgEl("feColorMatrix", { in: "b", mode: "matrix", values: "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10", result: "g" }));
    goo.appendChild(svgEl("feBlend", { in: "SourceGraphic", in2: "g" }));
    defsSvg.appendChild(goo);
    ov.appendChild(defsSvg);

    // Full-screen layer: dark backdrop with a hole shaped like the logo's centre, the logo on top.
    const svg = svgEl("svg", { viewBox: `${-W / 2} ${-CY} ${W} ${H}`, width: "100%", height: "100%" });
    svg.style.cssText = "position:absolute;inset:0;display:block;overflow:visible";
    ov.appendChild(svg);
    const k = (B * 0.19) / R;
    // Zoom far enough that the logo's centre (narrowest at ~38% of the radius) covers the whole screen.
    const zMax = (Math.hypot(W, H) / 2 / (38 * k)) * 1.2;
    const zoom = svgEl("g");
    const maskId = "orbit-intro-mask";
    const mask = svgEl("mask", { id: maskId, maskUnits: "userSpaceOnUse", x: "-9000", y: "-9000", width: "18000", height: "18000" });
    mask.appendChild(svgEl("rect", { x: "-9000", y: "-9000", width: "18000", height: "18000", fill: "#fff" }));
    mask.appendChild(svgEl("polygon", { points: corePoints(1), fill: "#000" }));
    svg.appendChild(mask);
    zoom.appendChild(svgEl("rect", { x: "-9000", y: "-9000", width: "18000", height: "18000", fill: BG, mask: `url(#${maskId})` }));
    const core = svgEl("polygon", { points: corePoints(1.01), fill: BG });
    zoom.appendChild(core);
    svg.appendChild(zoom);

    // Emblem: glow + five pieces cut out of the real logo PNG with the traced outlines.
    const defs = svgEl("defs");
    const rg = svgEl("radialGradient", { id: "orbit-intro-g" });
    [["0", "rgb(181,124,246)", ".75"], [".45", "rgb(63,121,253)", ".32"], ["1", "rgb(63,121,253)", "0"]].forEach((s) =>
      rg.appendChild(svgEl("stop", { offset: s[0], "stop-color": s[1], "stop-opacity": s[2] })),
    );
    defs.appendChild(rg);
    const soft = svgEl("filter", { id: "orbit-intro-s", x: "-30%", y: "-30%", width: "160%", height: "160%" });
    soft.appendChild(svgEl("feGaussianBlur", { stdDeviation: "4", in: "SourceGraphic", result: "b" }));
    const merge = svgEl("feMerge");
    merge.appendChild(svgEl("feMergeNode", { in: "b" }));
    merge.appendChild(svgEl("feMergeNode", { in: "SourceGraphic" }));
    soft.appendChild(merge);
    defs.appendChild(soft);
    svg.insertBefore(defs, svg.firstChild);
    const glow = svgEl("circle", { r: "150", fill: "url(#orbit-intro-g)", class: "oi-glow" });
    const group = svgEl("g", { filter: "url(#orbit-intro-s)" });
    const petals: Element[] = [];
    LOGO.petals.forEach((pc, i) => {
      const clip = svgEl("clipPath", { id: `orbit-intro-c${i}` });
      clip.appendChild(svgEl("path", { d: pc.d, "stroke-linejoin": "round" }));
      defs.appendChild(clip);
      const g = svgEl("g");
      g.appendChild(
        svgEl("image", {
          href: opts.emblemUrl, x: String(LOGO.img.x), y: String(LOGO.img.y), width: String(LOGO.img.w), height: String(LOGO.img.w),
          "clip-path": `url(#orbit-intro-c${i})`, preserveAspectRatio: "none",
        }),
      );
      group.appendChild(g);
      petals.push(g);
    });
    zoom.appendChild(glow);
    zoom.appendChild(group);

    let z = 1;
    let rot = 0;
    const apply = () => zoom.setAttribute("transform", `scale(${k * z}) rotate(${rot})`);
    apply();

    // Wordmark in the app's font (Instrument Sans via next/font), below the logo.
    const wm = div("oi-wm");
    wm.innerHTML = `<div class="oi-word">${"ORBIT".split("").map((c) => `<span>${c}</span>`).join("")}</div><div class="oi-tag">EXPLORE OPPORTUNITIES</div>`;
    wm.style.cssText = `position:absolute;left:0;right:0;top:${CY + B * 0.3}px;opacity:0`;
    ov.appendChild(wm);

    root.appendChild(ov);
    // Overlay is in place: the CSS cover is no longer needed.
    root.setAttribute("data-intro", "playing");

    // Skip: any tap, click or key ends it with a quick fade.
    const skip = () => fadeOut(250);
    window.addEventListener("pointerdown", skip, true);
    window.addEventListener("keydown", skip, true);
    cleanups.push(() => {
      window.removeEventListener("pointerdown", skip, true);
      window.removeEventListener("keydown", skip, true);
    });

    // ---- reduced motion: static logo + wordmark, then a short fade ----
    if (opts.reducedMotion) {
      glow.style.opacity = ".6";
      wm.style.opacity = "1";
      return { still: true } as const;
    }

    petals.forEach((p) => ((p as SVGElement).style.opacity = "0"));

    // Opening: drops of the logo's colours swirl in and melt together where the logo will be.
    const size = B * 0.38;
    const blobs = div("oi-blobs");
    blobs.style.width = `${size}px`;
    blobs.style.left = `${W / 2}px`;
    blobs.style.top = `${CY}px`;
    ov.appendChild(blobs);
    const fills = ["#4a6dff", "#ffad66", "#9d8cff", "#f1dccb", "#b77cff"];
    const items = fills.map((c, i) => {
      const b = div("oi-blob");
      b.style.background = `radial-gradient(circle at 35% 35%, #fff 0 8%, ${c} 45%, ${c})`;
      blobs.appendChild(b);
      const mid = LOGO.petals[i].mid;
      return { b, a0: mid + 200 + Math.random() * 60, r0: size * (1.15 + Math.random() * 0.4), a1: mid, r1: size * 0.24 };
    });

    return {
      still: false,
      play(imageReady: Promise<void>) {
        return tween(1350, (t) => {
          for (const it of items) {
            const a = lerp(it.a0, it.a1, t);
            const rr = lerp(it.r0, it.r1, t);
            const pt = polar(rr, a);
            it.b.style.transform = `translate(${pt.x}px, ${pt.y}px) scale(${lerp(0.55, 1.05, t)})`;
          }
        }, easeOut)
          .then(() => imageReady)
          .then(() => {
            if (dead) return;
            // The drops become the real logo and the wordmark wipes in.
            blobs.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 520, fill: "forwards" });
            petals.forEach((p) => { tween(560, (t) => ((p as SVGElement).style.opacity = String(t)), easeOut); });
            tween(620, (t) => { z = lerp(0.88, 1, t); apply(); }, easeOut);
            glow.animate([{ opacity: 0, transform: "scale(.6)" }, { opacity: 0.85, transform: "scale(1.2)" }, { opacity: 0.6, transform: "scale(1)" }], { duration: 900, delay: 120, fill: "forwards" });
            wm.animate([{ opacity: 1, clipPath: "inset(0 100% 0 0)" }, { opacity: 1, clipPath: "inset(0 0 0 0)" }], { duration: 750, delay: 350, easing: "cubic-bezier(.6,0,.2,1)", fill: "both" });
            return wait(1500);
          })
          .then(() => {
            if (dead) return;
            // Ending: the centre opens onto the real page and the logo grows past the viewer.
            ov.style.background = "transparent";
            tween(320, (t) => core.setAttribute("opacity", String(1 - t)), (t) => t);
            glow.animate([{ opacity: 0.6 }, { opacity: 0 }], { duration: 500, fill: "forwards" });
            wm.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(60px) scale(1.8)" }], { duration: 750, easing: "cubic-bezier(.5,0,.75,0)", fill: "forwards" });
            return tween(1500, (t) => { z = lerp(1, zMax, t); rot = lerp(0, 28, t); apply(); }, (t) => t * t * t, 100);
          })
          .then(finish);
      },
    } as const;
  }

  try {
    // Everything is bounded: whatever happens, the page is uncovered after maxMs.
    later(opts.maxMs, finish);

    const img = new Image();
    const imageReady = new Promise<void>((res) => {
      img.onload = () => res();
      img.onerror = () => finish(); // never leave the page covered
    });

    const build = mount();
    if (build.still) {
      imageReady.then(() => {
        if (dead) return;
        later(700, () => fadeOut(250));
      });
    } else {
      build.play(imageReady).catch(finish);
    }
    img.src = opts.emblemUrl;
  } catch {
    finish();
  }
}
