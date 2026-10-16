import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdminHeader, TableSkeleton } from "@/components/admin/primitives";
import { getSource, listFormOptions } from "@/lib/sources/queries";
import { SourceForm } from "../../_components/SourceForm";

export const metadata = { title: "Edit source · ORBIT admin" };

export default function EditSourcePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <AdminHeader
        eyebrow="Sources"
        title="Edit source"
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <EditForm params={params} />
      </Suspense>
    </>
  );
}

async function EditForm({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [source, { organisers, categories }] = await Promise.all([getSource(id), listFormOptions()]);
  if (!source) notFound();
  return <div><SourceForm source={source} organisers={organisers} categories={categories} /></div>;
}
