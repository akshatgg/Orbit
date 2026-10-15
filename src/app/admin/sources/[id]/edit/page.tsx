import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { getSource, listFormOptions } from "@/lib/sources/queries";
import { SourceForm } from "../../_components/SourceForm";

export const metadata = { title: "Edit source · ORBIT admin" };

export default function EditSourcePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader
        title="Edit source"
        back={<Link href="/admin/sources" className="text-sm text-muted hover:text-fg">← Sources</Link>}
      />
      <Suspense fallback={<ListSkeleton />}>
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
  return <div className="px-4"><SourceForm source={source} organisers={organisers} categories={categories} /></div>;
}
