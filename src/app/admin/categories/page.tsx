import { Suspense } from "react";
import type { Metadata } from "next";
import { AddCategoryForm, CategoryEditRow, type CategoryRow } from "@/components/admin/CategoryManager";
import { AdminHeader, Panel, TableSkeleton } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/auth";
import { authed } from "@/lib/api/session";

export const metadata: Metadata = { title: "Categories · Admin" };

export default function Page() {
  return (
    <>
      <AdminHeader eyebrow="Taxonomy" title="Categories" subtitle="What kinds of events ORBIT groups things into. Lower sort order shows first." />
      <Suspense fallback={<TableSkeleton rows={6} />}>
        <Content />
      </Suspense>
      <Toaster />
    </>
  );
}

async function Content() {
  await requireAdmin();
  const { items: rows } = await authed.get<{ items: CategoryRow[] }>("/admin/categories");

  return (
    <div className="space-y-6">
      <Panel title="Add a category">
        <AddCategoryForm />
      </Panel>
      <Panel title={`All categories (${rows.length})`}>
        <ul className="divide-y divide-line/60">
          {rows.map((r) => <CategoryEditRow key={r.id} row={r} />)}
        </ul>
      </Panel>
    </div>
  );
}
