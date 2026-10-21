import { Suspense } from "react";
import { connection } from "next/server";
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
        subtitle="An iCal feed or a Luma, Meetup, Eventbrite or Fatsoma link we have permission to use"
      />
      <Suspense fallback={<TableSkeleton rows={4} />}>
        <NewForm />
      </Suspense>
    </>
  );
}

async function NewForm() {
  // Supabase reads the session cookie to attach the access token, and token expiry is
  // compared with the clock — so this can't be prerendered.
  await connection();
  const { organisers, categories } = await listFormOptions();
  return <div><SourceForm organisers={organisers} categories={categories} /></div>;
}
