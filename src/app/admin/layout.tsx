import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminShell, type AdminLink } from "@/components/admin/AdminShell";
import { TableSkeleton } from "@/components/admin/primitives";

import type { Metadata } from "next";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const LINKS: AdminLink[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organisers", label: "Organisers", group: "Manage" },
  { href: "/admin/events", label: "Events", group: "Manage" },
  { href: "/admin/users", label: "Users & admins", group: "Manage" },
  { href: "/admin/categories", label: "Categories", group: "Manage" },
  { href: "/admin/import", label: "CSV import", group: "Data" },
  { href: "/admin/sources", label: "Sources", group: "Data" },
];

async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

/** Admin dashboard shell. Only admins and the super admin get past AdminGate. */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <AdminShell links={LINKS}>
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </AdminShell>
  );
}
