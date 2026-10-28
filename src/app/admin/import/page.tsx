import { Suspense } from "react";
import type { Metadata } from "next";
import { CsvImporter } from "@/components/admin/CsvImporter";
import { AdminHeader, TableSkeleton } from "@/components/admin/primitives";
import { requireAdmin } from "@/lib/auth";
import { importOptions } from "@/lib/admin/options";

export const metadata: Metadata = { title: "CSV import · Admin" };

export default function Page() {
  return (
    <>
      <AdminHeader eyebrow="Events" title="CSV import" subtitle="Bulk-add events from a spreadsheet. Imported events are published straight away." />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await requireAdmin();
  const { organisers, categories } = await importOptions();
  return (
    <CsvImporter
      organiserSlugs={organisers.map((o) => o.slug)}
      categorySlugs={categories.map((c) => c.slug)}
    />
  );
}
