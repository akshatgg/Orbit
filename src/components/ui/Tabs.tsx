"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Segmented link tabs, e.g. Feed / This week / Calendar. Active = exact match (or prefix when `prefix`). */
export function Tabs({ items }: { items: { href: string; label: string; prefix?: boolean }[] }) {
  const pathname = usePathname();
  return (
    <nav className="mx-4 mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
      {items.map(({ href, label, prefix }) => {
        const active = prefix ? pathname.startsWith(href) : pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors ${
              active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
