import { Suspense } from "react";
import type { Metadata } from "next";
import { EventForm } from "@/components/admin/EventForm";
import { AdminHeader, TableSkeleton } from "@/components/admin/primitives";
import { requireAdmin } from "@/lib/auth";
import { importOptions } from "@/lib/admin/options";
import { saveEvent } from "../actions";

export const metadata: Metadata = { title: "Add event · Admin" };

export default function Page() {
  return (
    <div className="mx-auto max-w-3xl">
      <AdminHeader eyebrow="Events" title="Add event" subtitle="List an event on ORBIT yourself. It's published straight away." />
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  await requireAdmin();
  const { organisers, categories } = await importOptions();
  return (
    <EventForm
      action={saveEvent.bind(null, null)}
      organisers={organisers.filter((o) => o.status === "approved")}
      categories={categories}
      submitLabel="Publish event"
    />
  );
}
