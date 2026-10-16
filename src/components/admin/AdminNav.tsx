"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type AdminLink = { href: string; label: string };

/** Admin section nav. The active item gets a soft glass pill; `/admin` matches exactly, the rest by prefix. */
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
            className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
              active
                ? "border-ink/15 bg-ink/[0.1] text-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] light:border-transparent light:bg-accent/10 light:text-accent light:shadow-none"
                : "border-transparent text-muted hover:bg-ink/[0.06] hover:text-fg"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
