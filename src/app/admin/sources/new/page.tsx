import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { listFormOptions } from "@/lib/sources/queries";
import { SourceForm } from "../_components/SourceForm";

export const metadata = { title: "Add source · ORBIT admin" };

export default function NewSourcePage() {
  return (
    <>
      <PageHeader
        title="Add source"
        subtitle="An iCal feed we have permission to use"
        back={<Link href="/admin/sources" className="text-sm text-muted hover:text-fg">← Sources</Link>}
      />
      <Suspense fallback={<ListSkeleton />}>
        <NewForm />
      </Suspense>
    </>
  );
}

async function NewForm() {
  const { organisers, categories } = await listFormOptions();
  return <div className="px-4"><SourceForm organisers={organisers} categories={categories} /></div>;
}
