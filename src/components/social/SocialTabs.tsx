import Link from "next/link";
import { Tabs } from "@/components/ui/Tabs";

/** Circles ↔ Communities switch at the top of both directories. */
export function SocialTabs() {
  return (
    <Tabs
      items={[
        { href: "/circles", label: "Circles" },
        { href: "/communities", label: "Communities", prefix: true },
      ]}
    />
  );
}

/** Server-rendered segmented links (state lives in the URL), e.g. Events / Members / Chat. */
export function SegmentLinks({ label, items }: { label: string; items: { href: string; label: string; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label={label} className="glass mx-4 flex gap-1 rounded-full p-1 md:max-w-md">
      {items.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          replace
          scroll={false}
          aria-current={t.active ? "page" : undefined}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-center text-sm font-medium transition duration-200 motion-reduce:transition-none ${t.active ? "bg-ink/[0.12] text-fg" : "text-muted hover:text-fg"}`}
        >
          {t.label}
          {t.count ? <span className="rounded-full bg-accent px-1.5 text-[10.5px] font-semibold leading-4 text-white tabular-nums">{t.count > 9 ? "9+" : t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
