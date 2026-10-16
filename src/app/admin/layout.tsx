import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/admin/AdminNav";
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
      <header className="glass sticky top-0 z-40 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 sm:flex-nowrap sm:gap-6 sm:px-6">
          <Link href="/admin" className="flex shrink-0 items-center gap-2.5">
            <Image src="/brand/orbit-mark.png" alt="" width={26} height={26} />
            <span className="font-display text-[11px] font-semibold tracking-[0.3em]">ORBIT ADMIN</span>
          </Link>
          <Suspense fallback={<div className="order-last h-8 w-full sm:order-none sm:w-auto sm:flex-1" />}>
            <AdminNav links={LINKS} />
          </Suspense>
          <Link href="/" className="ml-auto shrink-0 whitespace-nowrap text-sm text-muted sm:ml-0 transition-colors hover:text-fg">Back to app</Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 pb-20 pt-8 sm:px-6">
        <Suspense fallback={<TableSkeleton rows={5} />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </main>
    </div>
  );
}
