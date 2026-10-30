"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DesktopHeaderFrame } from "./DesktopHeader";

const TABS = [
  { href: "/", label: "For You", match: (p: string) => p === "/" || p === "/week" || p === "/calendar", icon: "M4 11.500 12 5l8 6.500V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" },
  { href: "/search", label: "Explore", match: (p: string) => p.startsWith("/search"), icon: "M11 4.500a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm9 15.5-3.9-3.9" },
  {
    href: "/communities",
    label: "Community",
    match: (p: string) => p.startsWith("/communities") || p.startsWith("/circles") || p.startsWith("/join/"),
    icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9a6 6 0 0 1 12 0m1.5-9a3 3 0 1 0 0-6m1.5 15h3a5 5 0 0 0-4.500-5",
  },
  { href: "/tickets", label: "Tickets", match: (p: string) => p.startsWith("/tickets"), icon: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.500a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.500a2.5 2.5 0 0 0 0-5zm10-2v12" },
  { href: "/profile", label: "Profile", match: (p: string) => p.startsWith("/profile"), icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8.500a7 7 0 0 1 14 0" },
] as const;

/** Last tab for people who host events (members of an organisation, or who chose the Host goal). */
const STUDIO_TAB = {
  href: "/organiser",
  label: "Studio",
  match: (p: string) => p.startsWith("/organiser"),
  icon: "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM16 13v6m-3-3h6",
} as const;

/** Phone tab bar that highlights the current tab. Render inside <Suspense> (it reads the URL). */
export function BottomNav({ showStudio = false }: { showStudio?: boolean }) {
  const pathname = usePathname();
  // The event editor has its own fixed Back / Next bar at the bottom of phones and tablets.
  const editing = /^\/organiser\/events\/(new|[^/]+\/edit)\/?$/.test(pathname);
  return (
    <>
      {!editing && <BottomNavView pathname={pathname} showStudio={showStudio} />}
    </>
  );
}

/** Instant fallback while the URL and session stream in: both layouts, CSS picks one. */
export function NavFallback() {
  return (
    <>
      <BottomNavView pathname={null} />
      <DesktopHeaderFrame />
    </>
  );
}

/** The same tab bar without reading the URL: the instant fallback while the URL streams in. */
export function BottomNavView({ pathname, showStudio = false }: { pathname: string | null; showStudio?: boolean }) {
  const tabs = showStudio ? [...TABS, STUDIO_TAB] : TABS;
  const count = tabs.length;
  const activeIndex = pathname === null ? -1 : tabs.findIndex((t) => t.match(pathname));
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),12px)] z-30 mx-auto max-w-md md:hidden"
    >
      <ul
        className="glass-strong relative grid rounded-[24px] p-1.5"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
      >
        {activeIndex >= 0 && (
          <li
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-[18px] bg-ink/[0.1] transition-transform duration-300 ease-out motion-reduce:transition-none light:bg-accent/[0.1]"
            style={{ width: `calc((100% - 0.75rem) / ${count})`, transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
        {tabs.map(({ href, label, icon }, i) => {
          const active = i === activeIndex;
          return (
            <li key={href} className="relative">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 rounded-full py-2 font-medium ${count > 5 ? "text-[10px] tracking-tight" : "text-[10.5px]"} transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  active ? "text-fg light:text-accent" : "text-muted hover:text-fg"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={icon} />
                </svg>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
