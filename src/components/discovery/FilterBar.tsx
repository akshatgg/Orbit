"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from "react";
import {
  FILTER_KEYS, FILTER_TITLES, clearKeyHref, isActive, isMultiKey, optionsFor, pickHref, pillLabel, placeValue, selectedValues,
  showClearAll, type FilterKey, type Option,
} from "@/lib/discovery/filter-bar";
import { clearFiltersHref, type SearchFilters } from "@/lib/discovery/filters";
import type { PlaceGroup } from "@/lib/places";

const PANEL_W = 264;

const Chevron = ({ open }: { open: boolean }) => (
  <svg aria-hidden viewBox="0 0 24 24" className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
);

const Check = () => (
  <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 8.5l3 3 6-7" /></svg>
);

/**
 * Compact filter bar: one pill per filter, each opening a popover (desktop) or bottom sheet (mobile).
 * `keys` picks which pills to show (Explore leaves out Category: its CategoryRail does that job).
 */
export function FilterBar({ filters, categories, places, keys = FILTER_KEYS }: {
  filters: SearchFilters;
  categories: Option[];
  places: PlaceGroup[];
  keys?: readonly FilterKey[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [openKey, setOpenKey] = useState<FilterKey | null>(null);
  const [pos, setPos] = useState({ x: 8, y: 0 });
  const pillRefs = useRef<Partial<Record<FilterKey, HTMLButtonElement | null>>>({});
  const panelRef = useRef<HTMLDivElement>(null);
  const baseId = useId();

  const go = useCallback((href: string) => startTransition(() => router.push(href, { scroll: false })), [router]);

  const close = useCallback((restoreFocus = true) => {
    setOpenKey((k) => {
      if (k && restoreFocus) pillRefs.current[k]?.focus();
      return null;
    });
  }, []);

  function toggle(key: FilterKey) {
    if (openKey === key) return close();
    const r = pillRefs.current[key]?.getBoundingClientRect();
    if (r) setPos({ x: Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8)), y: r.bottom + 8 });
    setOpenKey(key);
  }

  // Lock body scroll while the mobile sheet is open; close on outside scroll/resize (popover is fixed).
  useEffect(() => {
    if (!openKey) return;
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    const prev = document.body.style.overflow;
    if (mobile) document.body.style.overflow = "hidden";
    const onScroll = (e: Event) => {
      if (!mobile && !panelRef.current?.contains(e.target as Node)) setOpenKey(null);
    };
    const onResize = () => setOpenKey(null);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [openKey]);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (!openKey) return;
    const el = panelRef.current;
    if (!el) return;
    const target =
      el.querySelector<HTMLElement>('[aria-checked="true"]') ?? el.querySelector<HTMLElement>('[role^="menuitem"], input');
    target?.focus();
  }, [openKey]);

  function onPanelKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      return close();
    }
    const el = panelRef.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>('[role^="menuitem"]')];
    const focusables = [...el.querySelectorAll<HTMLElement>('button, input, a[href]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!items.length) return;
      e.preventDefault();
      const d = e.key === "ArrowDown" ? 1 : -1;
      items[(i + d + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      if (!items.length) return;
      e.preventDefault();
      items[e.key === "Home" ? 0 : items.length - 1]?.focus();
    } else if (e.key === "Tab" && focusables.length) {
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  const pill =
    "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

  return (
    <div aria-busy={pending} className="px-4">
      <div
        role="toolbar"
        aria-label="Filter events"
        onKeyDown={(e) => { if (e.key === "Escape" && openKey) close(); }}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {keys.map((key) => {
          const active = isActive(filters, key);
          const open = openKey === key;
          return (
            <span key={key} className="inline-flex shrink-0 items-center">
              <button
                ref={(el) => { pillRefs.current[key] = el; }}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? `${baseId}-panel` : undefined}
                onClick={() => toggle(key)}
                className={`${pill} ${
                  active
                    ? "bg-gradient border-transparent font-medium text-bg"
                    : "border-ink/10 bg-ink/[0.045] text-muted hover:border-ink/20 hover:bg-ink/[0.08] hover:text-fg"
                } ${active ? "rounded-r-none pr-2.5" : ""}`}
              >
                <span className="max-w-[10rem] truncate">{pillLabel(filters, key, categories)}</span>
                <Chevron open={open} />
              </button>
              {active && (
                <Link
                  href={clearKeyHref(filters, key)}
                  scroll={false}
                  aria-label={`Clear ${FILTER_TITLES[key]} filter`}
                  className="bg-gradient inline-flex h-9 items-center rounded-r-full border border-l border-transparent border-l-black/10 pl-2 pr-3 text-xs text-bg/70 transition-colors hover:text-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <span aria-hidden>✕</span>
                </Link>
              )}
            </span>
          );
        })}
        {showClearAll(filters) && (
          <Link
            href={clearFiltersHref(filters)}
            scroll={false}
            className={`${pill} border-transparent px-3 text-muted underline-offset-4 hover:text-fg hover:underline`}
          >
            Clear all
          </Link>
        )}
      </div>

      {openKey && (
        <>
          <div aria-hidden onClick={() => close(false)} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none" />
          <div
            id={`${baseId}-panel`}
            ref={panelRef}
            role="menu"
            aria-label={FILTER_TITLES[openKey]}
            onKeyDown={onPanelKey}
            style={{ "--fx": `${pos.x}px`, "--fy": `${pos.y}px` } as React.CSSProperties}
            className="glass-strong fixed inset-x-0 bottom-0 z-50 flex max-h-[75dvh] flex-col rounded-t-[28px] pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:bottom-auto sm:left-[var(--fx)] sm:top-[var(--fy)] sm:max-h-[min(24rem,70dvh)] sm:w-[264px] sm:rounded-[20px] sm:pb-0"
          >
            <div className="sm:hidden">
              <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-ink/20" />
              <div className="flex items-center justify-between px-5 pb-1 pt-3">
                <h2 className="font-display text-base font-semibold">{FILTER_TITLES[openKey]}</h2>
                <button type="button" onClick={() => close()} className="rounded-full px-2 py-1 text-sm text-muted hover:text-fg">Done</button>
              </div>
            </div>
            {openKey === "location" ? (
              <PlaceList
                places={places}
                selected={selectedValues(filters, "location")[0] ?? null}
                onPick={(v) => { go(pickHref(filters, "location", v)); close(); }}
              />
            ) : (
              <OptionList
                kind={openKey}
                options={optionsFor(openKey, categories)}
                selected={selectedValues(filters, openKey)}
                onPick={(v) => {
                  go(pickHref(filters, openKey, v));
                  if (!isMultiKey(openKey)) close();
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function OptionList({ kind, options, selected, onPick }: {
  kind: FilterKey; options: Option[]; selected: string[]; onPick: (v: string) => void;
}) {
  const multi = isMultiKey(kind);
  return (
    <div className="overflow-y-auto overscroll-contain p-1.5">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multi ? "menuitemcheckbox" : "menuitemradio"}
            aria-checked={on}
            tabIndex={-1}
            onClick={() => onPick(o.value)}
            className={`flex w-full items-center justify-between gap-3 rounded-[14px] px-3.5 py-2.5 text-left text-sm transition-colors focus-visible:bg-ink/[0.1] focus-visible:outline-none hover:bg-ink/[0.07] ${on ? "font-medium text-fg" : "text-muted"}`}
          >
            <span className="truncate">{o.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              {o.count !== undefined && <span className="text-xs tabular-nums text-subtle">{o.count}</span>}
              {on && <span className="text-accent"><Check /></span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Countries (flag, name, count), each followed by its cities. Picking a country covers all of it. */
function PlaceList({ places, selected, onPick }: { places: PlaceGroup[]; selected: string | null; onPick: (v: string) => void }) {
  if (!places.length) return <p className="px-5 py-6 text-center text-sm text-muted">No places yet: upcoming events are all online.</p>;
  const row = "flex w-full items-center justify-between gap-3 rounded-[14px] py-2.5 pr-3.5 text-left text-sm transition-colors focus-visible:bg-ink/[0.1] focus-visible:outline-none hover:bg-ink/[0.07]";
  const item = (value: string, label: React.ReactNode, count: number, className: string) => {
    const on = selected === value;
    return (
      <button
        key={value}
        type="button"
        role="menuitemradio"
        aria-checked={on}
        tabIndex={-1}
        onClick={() => onPick(value)}
        className={`${row} ${className} ${on ? "font-medium text-fg" : "text-muted"}`}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="text-xs tabular-nums text-subtle">{count}</span>
          {on && <span className="text-accent"><Check /></span>}
        </span>
      </button>
    );
  };
  return (
    <div className="overflow-y-auto overscroll-contain p-1.5">
      {places.map((group) => (
        <div key={group.country ?? "other"} role="group" aria-label={group.name} className="pb-1">
          {group.country
            ? item(
              placeValue(group.country, ""),
              <>
                <span aria-hidden className="text-base leading-none">{group.flag}</span>
                <span className="truncate font-semibold text-fg">{group.name}</span>
              </>,
              group.count,
              "pl-3.5",
            )
            : <p className="px-3.5 pb-1 pt-2.5 text-xs font-medium text-subtle">{group.name}</p>}
          {group.cities.map((c) => item(placeValue(group.country, c.city), <span className="truncate">{c.city}</span>, c.count, "pl-10"))}
        </div>
      ))}
    </div>
  );
}
