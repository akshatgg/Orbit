"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { parsePlaceValue, placeValue } from "@/lib/discovery/filter-bar";
import type { PlaceGroup } from "@/lib/places";
import { OrbitLogo } from "@/components/brand/OrbitLogo";
import { MessagesLink } from "@/components/social/MessagesLink";
import { NotificationBell } from "@/components/social/NotificationBell";

type NavLink = { href: string; label: string; match: (p: string) => boolean; className?: string };

// Circles (which switches to Communities with one tap) shows from xl, where the search still keeps
// its room; narrower, both are on the profile page. Messages and notifications are icons with their
// unread counts at every width.
const LINKS: readonly NavLink[] = [
  { href: "/search", label: "Explore", match: (p: string) => p.startsWith("/search") },
  { href: "/calendar", label: "Calendar", match: (p: string) => p.startsWith("/calendar") },
  { href: "/tickets", label: "Tickets", match: (p: string) => p.startsWith("/tickets") },
  {
    href: "/circles",
    label: "Circles",
    match: (p: string) => p.startsWith("/circles") || p.startsWith("/communities") || p.startsWith("/join/circle"),
    className: "hidden xl:inline-flex",
  },
];

const STUDIO: NavLink = { href: "/organiser", label: "Studio", match: (p: string) => p.startsWith("/organiser") };

const SEARCH_ICON = "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3";
const PIN_ICON = "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z";

function Icon({ path, className = "h-[18px] w-[18px]" }: { path: string; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

/**
 * Tablet and laptop (md+) navigation: one bar across the top, like Eventbrite or Meetup. Logo on the
 * left, search with a place picker in the middle, then the main pages, Create event (an icon below
 * xl), the theme toggle (lg+), messages, notifications and the profile. Phones keep their own top bar and tab bar.
 */
export function DesktopHeader({ places, showStudio, createHref, avatar }: {
  places: PlaceGroup[];
  showStudio: boolean;
  createHref: string;
  /** The profile picture, rendered on the server. */
  avatar: ReactNode;
}) {
  const pathname = usePathname();
  const links = showStudio ? [...LINKS, STUDIO] : LINKS;
  return (
    <DesktopHeaderFrame>
      <HeaderSearch places={places} />
      <nav aria-label="Primary" className="flex shrink-0 items-center gap-1">
        {links.map(({ href, label, match, className = "" }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent lg:px-3.5 ${className} ${
                active ? "bg-ink/[0.08] text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </Link>
          );
        })}
        <Link
          href={createHref}
          className="bg-gradient ml-1.5 hidden rounded-full px-4 py-2 text-sm font-semibold text-bg transition duration-200 ease-out hover:opacity-90 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none xl:inline-flex"
        >
          Create event
        </Link>
        <Link
          href={createHref}
          aria-label="Create event"
          title="Create event"
          className="bg-gradient ml-1 flex h-9 w-9 items-center justify-center rounded-full text-bg transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent xl:hidden"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        </Link>
        {/* Below lg the bar is tight: the theme lives on the profile page (Appearance) there. */}
        <ThemeToggle className="ml-1 hidden h-9 w-9 lg:flex" />
        <MessagesLink className="ml-0.5 h-9 w-9" active={pathname.startsWith("/messages")} />
        <NotificationBell placement="header" className="ml-0.5 h-9 w-9" />
        <Link
          href="/profile"
          aria-label="Profile"
          aria-current={pathname.startsWith("/profile") ? "page" : undefined}
          className="ml-1 rounded-full ring-offset-2 ring-offset-bg transition hover:ring-2 hover:ring-ink/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:ring-2 aria-[current=page]:ring-accent"
        >
          {avatar}
        </Link>
      </nav>
    </DesktopHeaderFrame>
  );
}

/** The bar itself (also the instant fallback while the session streams in). */
export function DesktopHeaderFrame({ children }: { children?: ReactNode }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden border-b border-line bg-bg/80 backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-6 lg:gap-6">
        <Link href="/" aria-label="ORBIT home" className="flex shrink-0 items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <OrbitLogo size={30} priority className="h-[30px] w-[30px]" />
          <span className="hidden text-[14px] font-semibold tracking-[0.2em] lg:inline">ORBIT</span>
        </Link>
        {children}
      </div>
    </header>
  );
}

/** "Search events | 📍 Anywhere ▾ | (search)": submits to Explore with the text and the picked place. */
function HeaderSearch({ places }: { places: PlaceGroup[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const onExplore = pathname.startsWith("/search") || pathname === "/";
  const [q, setQ] = useState(onExplore ? params.get("q") ?? "" : "");
  const [place, setPlace] = useState(onExplore ? placeValue(params.get("country"), params.get("city") ?? "") : "");

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    const { country, city } = parsePlaceValue(place);
    if (country) next.set("country", country);
    if (city) next.set("city", city);
    const qs = next.toString();
    router.push(qs ? `/search?${qs}` : "/search");
  }

  return (
    <form role="search" onSubmit={submit} className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-ink/10 bg-ink/[0.045] pl-4 pr-1 transition-colors focus-within:border-ink/25 focus-within:bg-ink/[0.07]">
      <Icon path={SEARCH_ICON} className="h-[17px] w-[17px] text-subtle" />
      <label htmlFor="header-search" className="sr-only">Search events</label>
      <input
        id="header-search"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search events"
        maxLength={120}
        className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm text-fg outline-none placeholder:text-subtle"
      />
      <span aria-hidden className="h-6 w-px shrink-0 bg-line" />
      <label className="relative flex h-full shrink-0 items-center gap-1.5 pl-3 pr-2 text-sm text-muted">
        <Icon path={PIN_ICON} className="h-[16px] w-[16px] text-subtle" />
        <span className="sr-only">Location</span>
        <select
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          className="field-sizing-content h-full max-w-[9.5rem] cursor-pointer appearance-none bg-transparent pr-5 text-sm text-fg outline-none lg:max-w-[11rem]"
        >
          <option value="">Anywhere</option>
          {places.map((group) => (
            <optgroup key={group.country ?? "other"} label={`${group.flag} ${group.name}`.trim()}>
              {group.country && <option value={placeValue(group.country, "")}>All of {group.name}</option>}
              {group.cities.map((c) => (
                <option key={c.city} value={placeValue(group.country, c.city)}>{c.city}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-subtle" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
      </label>
      <button type="submit" aria-label="Search" className="bg-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-bg transition active:scale-95">
        <Icon path={SEARCH_ICON} className="h-4 w-4" />
      </button>
    </form>
  );
}
