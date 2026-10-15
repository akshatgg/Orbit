import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ListSkeleton } from "@/components/ui/Skeleton";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organisers", label: "Organisers" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/users", label: "Users & admins" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/import", label: "CSV import" },
  { href: "/admin/sources", label: "Sources" },
];

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

/** Admin dashboard shell. Only admins and the super admin get past AdminGate. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto min-h-dvh max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 py-5">
        <Link href="/admin" className="flex items-center gap-2">
          <Image src="/brand/orbit-mark.png" alt="" width={28} height={28} />
          <span className="font-display text-sm font-semibold tracking-[0.3em]">ORBIT ADMIN</span>
        </Link>
        <nav className="scrollbar-none flex gap-1 overflow-x-auto text-sm">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-muted hover:bg-surface hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="ml-auto text-sm text-muted hover:text-fg">Back to app</Link>
      </header>
      <Suspense fallback={<ListSkeleton />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </div>
  );
}
