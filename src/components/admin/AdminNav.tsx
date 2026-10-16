"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminLink = { href: string; label: string };

/** Admin section nav. The active item gets a pearl pill; `/admin` matches exactly, the rest by prefix. */
export function AdminNav({ links }: { links: AdminLink[] }) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav aria-label="Admin sections" className="scrollbar-none -mx-1 order-last flex w-full min-w-0 sm:order-none sm:w-auto sm:flex-1 gap-0.5 overflow-x-auto px-1 text-sm">
      {links.map((l) => {
        const active = isActive(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition-colors duration-200 ${
              active ? "bg-gradient text-bg" : "text-muted hover:bg-white/[0.06] hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
