"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "For You", match: (p: string) => p === "/" || p === "/week" || p === "/calendar", icon: "M12 3.5l2.3 5.2 5.7.6-4.3 3.8 1.2 5.6L12 15.8 7.1 18.700l1.2-5.600L4 9.300l5.7-.6z" },
  { href: "/search", label: "Explore", match: (p: string) => p.startsWith("/search"), icon: "M11 4.500a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zm9 15.5-3.9-3.9" },
  { href: "/tickets", label: "Tickets", match: (p: string) => p.startsWith("/tickets"), icon: "M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1.500a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-1.500a2.5 2.5 0 0 0 0-5zm10-2v12" },
  { href: "/profile", label: "Profile", match: (p: string) => p.startsWith("/profile"), icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8.500a7 7 0 0 1 14 0" },
] as const;

/** Fifth tab for people who host events (members of an organisation, or who chose the Host goal). */
const STUDIO_TAB = {
  href: "/organiser",
  label: "Studio",
  match: (p: string) => p.startsWith("/organiser"),
  icon: "M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM16 13v6m-3-3h6",
} as const;

/** Tab bar that highlights the current tab. Render inside <Suspense> (it reads the URL). */
export function BottomNav({ showStudio = false }: { showStudio?: boolean }) {
  return <BottomNavView pathname={usePathname()} showStudio={showStudio} />;
}

/** The same tab bar without reading the URL: the instant fallback while the URL streams in. */
export function BottomNavView({ pathname, showStudio = false }: { pathname: string | null; showStudio?: boolean }) {
  const tabs = showStudio ? [...TABS, STUDIO_TAB] : TABS;
  const count = tabs.length;
  const activeIndex = pathname === null ? -1 : tabs.findIndex((t) => t.match(pathname));
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-3 z-30 mx-auto max-w-md"
      style={{ bottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <ul className="glass-strong relative grid rounded-full p-1.5" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
        {activeIndex >= 0 && (
          <li
            aria-hidden
            className="pointer-events-none absolute bottom-1.5 left-1.5 top-1.5 rounded-full border border-white/25 bg-white/[0.14] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_6px_16px_-8px_rgb(0_0_0/0.6)] transition-transform duration-300 ease-out motion-reduce:transition-none"
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
                className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  active ? "text-white" : "text-muted hover:text-fg"
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
