import { Suspense } from "react";
import type { Metadata } from "next";
import { CsvImporter } from "@/components/admin/CsvImporter";
import { AdminHeader, TableSkeleton } from "@/components/admin/primitives";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const [{ data: orgs }, { data: cats }] = await Promise.all([
    supabase.from("organisers").select("slug"),
    supabase.from("categories").select("slug"),
  ]);
  return (
    <CsvImporter
      organiserSlugs={(orgs ?? []).map((o) => o.slug as string)}
      categorySlugs={(cats ?? []).map((c) => c.slug as string)}
    />
  );
}
