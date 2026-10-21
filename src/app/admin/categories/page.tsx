import { Suspense } from "react";
import type { Metadata } from "next";
import { AddCategoryForm, CategoryEditRow, type CategoryRow } from "@/components/admin/CategoryManager";
import { AdminHeader, Panel, TableSkeleton } from "@/components/admin/primitives";
import { Toaster } from "@/components/admin/Toaster";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const [{ data: cats }, { data: used }] = await Promise.all([
    supabase.from("categories").select("id, slug, name, group, sort_order, keywords").order("sort_order").order("name"),
    supabase.from("events").select("category_id").not("category_id", "is", null).limit(20000),
  ]);
  const counts = new Map<string, number>();
  for (const r of (used ?? []) as { category_id: string }[]) counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  const rows: CategoryRow[] = ((cats ?? []) as Omit<CategoryRow, "event_count">[]).map((c) => ({ ...c, event_count: counts.get(c.id) ?? 0 }));

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
