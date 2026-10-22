"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { categoryTabHref } from "@/lib/discovery/filter-bar";
import type { SearchFilters } from "@/lib/discovery/filters";
import { ICONS } from "./Layout";

/** Line icons for the seeded categories; anything an admin adds later gets the tag icon. */
const CATEGORY_ICONS: Record<string, string> = {
  all: "M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z",
  "employer-presentation": "M4 8h16v11H4zM9 8V5h6v3M4 13h16",
  "careers-fair": "M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6",
  workshop: "M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4",
  competition: "M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8",
  talk: "M12 4a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v3",
  networking: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5",
  society: "M5 21V4M5 4h11l-2 4 2 4H5",
  social: "M4 5h16v10H10l-5 4V5zM8 9h8M8 12h5",
  fitness: "M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10",
  entrepreneurship: "M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5V16h8v-2.5A6 6 0 0 0 12 3z",
  sustainability: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14zM5 19l7-7",
  "arts-culture": "M12 3a9 9 0 0 0 0 18c1 0 2-1 1-2s0-3 2-3h2a4 4 0 0 0 4-4c0-5-4-9-9-9zM7.5 11h.01M10 7h.01M15 7h.01",
};
const FALLBACK_ICON = "M3 12V4h8l9 9-8 8-9-9zM7.5 7.5h.01";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Categories as a scrolling row of tabs (like Meetup's): icon over label, an underline that slides
 * to the picked one, arrow buttons on laptops when the row overflows, swipe on phones. Picking a
 * category shows just that one; "All events" clears it.
 */
export function CategoryRail({ filters, categories, total = null }: {
  filters: SearchFilters;
  /** `count`: upcoming events in the category (a recurring series once). */
  categories: { value: string; label: string; count?: number }[];
  /** Upcoming events in all categories, beside "All events"; null when unknown. */
  total?: number | null;
}) {
  const current = filters.categories.length === 1 ? filters.categories[0] : filters.categories.length === 0 ? "all" : null;
  // A tap moves the underline straight away; once the URL changes (the navigation landed, or the
  // back button), the URL decides again.
  const [pick, setPick] = useState<{ value: string; from: string | null } | null>(null);
  const active = pick && pick.from === current ? pick.value : current;
  const [edges, setEdges] = useState({ start: false, end: false });
  const [bar, setBar] = useState<{ left: number; width: number } | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const tabs = useRef<Record<string, HTMLAnchorElement | null>>({});

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft > 4, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    const tab = active ? tabs.current[active] : null;
    setBar(tab ? { left: tab.offsetLeft, width: tab.offsetWidth } : null);
  }, [active]);

  useLayoutEffect(measure, [measure]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [measure]);

  // Keep the picked tab in view (without scrolling the page itself).
  useEffect(() => {
    const el = scroller.current;
    const tab = active ? tabs.current[active] : null;
    if (!el || !tab) return;
    const left = tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2;
    el.scrollTo({ left, behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active]);

  const page = (direction: 1 | -1) => {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  const items = [{ value: "all", label: "All events", count: total ?? undefined }, ...categories];
  const fade = `linear-gradient(to right, ${edges.start ? "transparent, #000 3rem" : "#000"}, ${edges.end ? "#000 calc(100% - 3rem), transparent" : "#000"})`;

  return (
    <nav aria-label="Categories" className="relative">
      <div
        ref={scroller}
        className="overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        <div className="relative flex w-max gap-1 border-b border-ink/10 px-4">
          {items.map((item) => {
            const selected = active === item.value;
            return (
              <Link
                key={item.value}
                ref={(el) => { tabs.current[item.value] = el; }}
                href={categoryTabHref(filters, item.value === "all" ? null : item.value)}
                scroll={false}
                aria-current={selected ? "page" : undefined}
                onClick={() => setPick({ value: item.value, from: current })}
                className={`group flex min-w-[4.75rem] flex-col items-center gap-1.5 rounded-t-xl px-3 pb-2.5 pt-2 text-center text-xs transition-colors duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  selected ? "font-semibold text-fg" : "text-muted hover:text-fg"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                    selected ? "bg-accent/15 text-accent" : "bg-ink/[0.05] group-hover:bg-ink/[0.09]"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={CATEGORY_ICONS[item.value] ?? FALLBACK_ICON} />
                  </svg>
                </span>
                <span className="whitespace-nowrap">
                  {item.label}
                  {item.count !== undefined && <span className="ml-1 font-normal tabular-nums text-subtle">({item.count})</span>}
                </span>
              </Link>
            );
          })}
          {bar && (
            <span
              aria-hidden
              className="absolute bottom-[-1px] left-0 h-0.5 rounded-full bg-fg transition-[transform,width] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: bar.width, transform: `translateX(${bar.left}px)` }}
            />
          )}
        </div>
      </div>

      {(["start", "end"] as const).map((side) =>
        edges[side] ? (
          <button
            key={side}
            type="button"
            onClick={() => page(side === "end" ? 1 : -1)}
            aria-label={side === "end" ? "More categories" : "Previous categories"}
            className={`absolute top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-fg text-bg shadow-lg transition active:scale-95 motion-reduce:transition-none sm:flex focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              side === "end" ? "right-1" : "left-1"
            }`}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d={side === "end" ? ICONS.chevronRight : ICONS.chevronLeft} />
            </svg>
          </button>
        ) : null,
      )}
    </nav>
  );
}
