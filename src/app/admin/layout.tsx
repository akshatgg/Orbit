import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/import", label: "CSV import" },
  { href: "/admin/categories", label: "Categories & tags" },
];

// TODO(piece 1): only allow profiles with role = 'admin'.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <span className="font-display text-lg font-semibold tracking-[0.3em]">ORBIT ADMIN</span>
        <nav className="flex flex-wrap gap-2 text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-lg border border-line px-3 py-1.5 text-muted hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
