"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { InstallButton } from "@/components/pwa/InstallButton";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SidebarIcon } from "./SidebarIcon";
import { useCollapsibleSidebar } from "./sidebar";

const TABS = [
  { href: "/", label: "For You", match: (p: string) => p === "/" || p === "/week" || p === "/calendar", icon: "M4 11.500 12 5l8 6.500V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1z" },
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
  const pathname = usePathname();
  // The event editor has its own fixed Back / Next bar at the bottom of phones and tablets.
  const editing = /^\/organiser\/events\/(new|[^/]+\/edit)\/?$/.test(pathname);
  return (
    <>
      {!editing && <BottomNavView pathname={pathname} showStudio={showStudio} />}
      <SideNavView pathname={pathname} showStudio={showStudio} />
    </>
  );
}

/** Instant fallback while the URL and session stream in: both layouts, CSS picks one. */
export function NavFallback() {
  return (
    <>
      <BottomNavView pathname={null} />
      <SideNavView pathname={null} />
    </>
  );
}

/** Desktop (lg+) navigation: a fixed sidebar that collapses to an icon rail and re-opens on hover. */
export function SideNavView({ pathname, showStudio = false }: { pathname: string | null; showStudio?: boolean }) {
  const tabs = showStudio ? [...TABS, STUDIO_TAB] : TABS;
  const { collapsed, expanded, overlay, toggle, handlers } = useCollapsibleSidebar("orbit-nav");

  return (
    <nav
      id="primary-nav"
      aria-label="Primary"
      {...handlers}
      className={`fixed inset-y-3 left-3 z-30 hidden flex-col transition-[width] duration-300 ease-out motion-reduce:transition-none lg:flex ${
        expanded ? "w-56" : "w-20"
      }`}
    >
      <div
        className={`glass-strong flex h-full flex-col rounded-[28px] p-3 ${
          overlay ? "shadow-[0_28px_70px_rgb(0_0_0/0.45)]" : ""
        }`}
      >
        <div className={`flex gap-1 ${expanded ? "items-center pr-0.5" : "flex-col items-center gap-1.5"}`}>
          <Link
            href="/"
            aria-label="ORBIT home"
            className={`flex items-center gap-2.5 rounded-2xl py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              expanded ? "min-w-0 flex-1 px-2" : "justify-center"
            }`}
          >
            <Image src="/brand/orbit-mark.png" alt="" width={32} height={32} className="h-8 w-8 shrink-0" />
            {expanded && <span className="truncate text-[13px] font-semibold tracking-[0.18em]">ORBIT</span>}
          </Link>
          <ThemeToggle className="h-8 w-8 shrink-0" />
          <button
            type="button"
            onClick={toggle}
            aria-controls="primary-nav"
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Pin the sidebar open" : "Collapse the sidebar"}
            title={collapsed ? "Pin open" : "Collapse"}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition duration-200 ease-out hover:bg-ink/[0.08] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-95 motion-reduce:transition-none"
          >
            <SidebarIcon collapsed={collapsed} />
          </button>
        </div>
        <ul className="mt-4 space-y-1">
          {tabs.map(({ href, label, icon, match }) => {
            const active = pathname !== null && match(pathname);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  aria-label={expanded ? undefined : label}
                  title={expanded ? undefined : label}
                  className={`flex items-center gap-3 rounded-full light:rounded-xl py-2.5 text-sm font-medium transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none ${
                    expanded ? "px-4" : "justify-center px-0"
                  } ${
                    active
                      ? "bg-ink/[0.1] text-fg light:bg-accent/10 light:text-accent"
                      : "text-muted hover:bg-ink/[0.06] hover:text-fg"
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d={icon} />
                  </svg>
                  {expanded && <span className="truncate whitespace-nowrap">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto flex justify-center pt-3">
          <InstallButton variant="link" label="Install the app" iconOnly={!expanded} />
        </div>
      </div>
    </nav>
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
      className="fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),12px)] z-30 mx-auto max-w-md lg:hidden"
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
                className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[10.5px] font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
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
