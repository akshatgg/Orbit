import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { EventForm } from "@/components/admin/EventForm";
import { AdminHeader, TableSkeleton } from "@/components/admin/primitives";
import { requireAdmin } from "@/lib/auth";
import { utcToUkLocalInput } from "@/lib/admin/time";
import { importOptions } from "@/lib/admin/options";
import { isNotFound } from "@/lib/api/errors";
import { authed } from "@/lib/api/session";
import type { OrbitEvent } from "@/types/database";
import { saveEvent } from "../../actions";

export const metadata: Metadata = { title: "Edit event · Admin" };

export default function Page({ params }: PageProps<"/admin/events/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <AdminHeader eyebrow="Events" title="Edit event" />
      <Suspense fallback={<TableSkeleton rows={5} />}>
        <Content params={params} />
      </Suspense>
    </div>
  );
}

async function Content({ params }: { params: PageProps<"/admin/events/[id]/edit">["params"] }) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ev, { organisers, categories }] = await Promise.all([
    authed.get<OrbitEvent>(`/admin/events/${id}`).catch((error) => {
      if (isNotFound(error)) return null;
      throw error;
    }),
    importOptions(),
  ]);
  if (!ev) notFound();
  if (ev.registration_mode === "tickets") {
    return (
      <p className="rounded-2xl border border-line bg-surface p-5 text-sm text-muted">
        This event sells ORBIT tickets, so it&apos;s edited from the organiser&apos;s page:{" "}
        <a className="text-blue hover:underline" href={`/organiser/events/${ev.id}/edit`}>open organiser editor</a>.
      </p>
    );
  }
  return (
    <EventForm
      action={saveEvent.bind(null, ev.id)}
      organisers={organisers}
      categories={categories}
      submitLabel="Save changes"
      values={{
        ...ev,
        starts_local: utcToUkLocalInput(ev.starts_at),
        ends_local: utcToUkLocalInput(ev.ends_at),
        registration_mode: ev.registration_mode as "external" | "none",
      }}
    />
  );
}
