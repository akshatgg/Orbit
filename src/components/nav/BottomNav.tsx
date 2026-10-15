"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "For You", match: (p: string) => p === "/" || p === "/week" || p === "/calendar", icon: "M12 3l2.6 5.6L20 9.3l-4 4.1.9 5.6L12 16.3 7.1 19l.9-5.6-4-4.1 5.4-.7z" },
  { href: "/search", label: "Explore", match: (p: string) => p.startsWith("/search"), icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3" },
  { href: "/tickets", label: "Tickets", match: (p: string) => p.startsWith("/tickets"), icon: "M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4zm10-2v12" },
  { href: "/profile", label: "Profile", match: (p: string) => p.startsWith("/profile"), icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/85 backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md justify-between px-2 pt-1.5">
        {TABS.map(({ href, label, match, icon }) => {
          const active = match(pathname);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium transition-colors ${
                  active ? "text-fg" : "text-muted hover:text-fg"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke={active ? "url(#orbit-grad)" : "currentColor"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d={icon} />
                </svg>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id="orbit-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#de9ffb" />
            <stop offset="0.4" stopColor="#3f79fd" />
            <stop offset="1" stopColor="#fdb570" />
          </linearGradient>
        </defs>
      </svg>
    </nav>
  );
}
