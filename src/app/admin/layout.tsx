import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { TableSkeleton } from "@/components/admin/primitives";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

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
    <div className="min-h-dvh">
      {/* Floating glass bar, like the app's tab bar: the page blurs behind it as you scroll. */}
      <header className="sticky top-0 z-40 mx-auto max-w-7xl px-3 pt-3 sm:px-6">
        <div className="glass-strong flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[22px] px-3 py-2 sm:flex-nowrap sm:gap-4 sm:pl-4">
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <Image src="/brand/orbit-mark.png" alt="" width={28} height={28} />
            <span className="text-[13px] font-semibold tracking-[0.2em]">ORBIT</span>
            <span className="rounded-full bg-ink/[0.08] px-2 py-0.5 text-[11px] font-medium text-muted">Admin</span>
          </Link>
          <Suspense fallback={<div className="order-last h-9 w-full sm:order-none sm:w-auto sm:flex-1" />}>
            <AdminNav links={LINKS} />
          </Suspense>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:ml-0">
            <ThemeToggle className="h-9 w-9" />
            <Link
              href="/"
              className="whitespace-nowrap rounded-full border border-ink/10 px-3.5 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-ink/[0.06] hover:text-fg"
            >
              Back to app
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-6 sm:px-6">
        <Suspense fallback={<TableSkeleton rows={5} />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
