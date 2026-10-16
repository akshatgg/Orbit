import { Suspense } from "react";
import { AdminHeader, TableSkeleton } from "@/components/admin/primitives";
import { listFormOptions } from "@/lib/sources/queries";
import { SourceForm } from "../_components/SourceForm";

export const metadata = { title: "Add source · ORBIT admin" };

export default function NewSourcePage() {
  return (
    <>
      <AdminHeader
        eyebrow="Sources"
        title="Add source"
        subtitle="An iCal feed we have permission to use"
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <NewForm />
      </Suspense>
    </>
  );
}

async function NewForm() {
  const { organisers, categories } = await listFormOptions();
  return <div><SourceForm organisers={organisers} categories={categories} /></div>;
}
