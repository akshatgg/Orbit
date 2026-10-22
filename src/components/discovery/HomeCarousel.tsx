"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const AUTO_MS = 6000;

/**
 * The big poster at the top of the laptop home page: slides (rendered on the server) side by side
 * in a snapping track, with arrows and dots. It moves on by itself every few seconds unless the
 * pointer or focus is on it, or the person prefers reduced motion.
 */
export function HomeCarousel({ slides, labels }: { slides: ReactNode[]; labels: string[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    const next = (i + count) % count;
    el.scrollTo({ left: next * el.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [count]);

  // Keep the dots in step with manual scrolling (trackpad swipes).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (paused || count < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go(index + 1), AUTO_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, count, go]);

  if (count === 0) return null;
  const arrow = "absolute top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white opacity-0 backdrop-blur transition duration-200 hover:bg-black/65 focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white group-hover:opacity-100";
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Top picks"
      className="group relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div ref={track} className="scrollbar-none flex snap-x snap-mandatory overflow-x-auto rounded-[28px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map((slide, i) => (
          <div key={i} role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${count}: ${labels[i]}`} className="w-full shrink-0 snap-start">
            {slide}
          </div>
        ))}
      </div>
      {count > 1 && (
        <>
          <button type="button" onClick={() => go(index - 1)} aria-label="Previous" className={`${arrow} left-4`}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <button type="button" onClick={() => go(index + 1)} aria-label="Next" className={`${arrow} right-4`}>
            <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
          </button>
          <div className="absolute bottom-5 right-6 z-10 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`Show ${labels[i]}`}
                aria-current={i === index ? "true" : undefined}
                className={`h-2 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-white" : "w-2 bg-white/45 hover:bg-white/70"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
