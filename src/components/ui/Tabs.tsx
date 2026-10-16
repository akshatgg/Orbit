"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Glass segmented link tabs, e.g. Feed / This week / Calendar. Active = exact match (or prefix when `prefix`). */
export function Tabs({ items }: { items: { href: string; label: string; prefix?: boolean }[] }) {
  const pathname = usePathname();
  const active = items.findIndex(({ href, prefix }) => (prefix ? pathname.startsWith(href) : pathname === href));
  return (
    <nav className="glass relative mx-4 mb-4 grid rounded-full p-1" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {active >= 0 && (
        <span
          aria-hidden
          className="bg-gradient absolute bottom-1 left-1 top-1 rounded-full transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `calc((100% - 0.5rem) / ${items.length})`, transform: `translateX(${active * 100}%)` }}
        />
      )}
      {items.map(({ href, label }, i) => (
        <Link
          key={href}
          href={href}
          aria-current={i === active ? "page" : undefined}
          className={`relative z-10 whitespace-nowrap rounded-full px-3 py-1.5 text-center text-sm font-medium transition-colors duration-200 ${
            i === active ? "text-bg" : "text-muted hover:text-fg"
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
