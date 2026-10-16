import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EventEditor } from "@/components/organiser/EventEditor";
import { BackLink } from "@/components/nav/BackLink";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getMyOrganisers, requireUser } from "@/lib/auth";
import { listCategories } from "@/lib/events/queries";
import { eventToForm } from "@/lib/organiser/event-form";
import { getEventForEdit } from "@/lib/organiser/queries";

export const metadata: Metadata = { title: "Edit event" };

export default function EditEventPage({ params }: PageProps<"/organiser/events/[id]/edit">) {
  return (
    <>
      <PageHeader back={<BackLink href="/organiser" label="Studio" />} title="Edit event" />
      <Suspense fallback={<div className="space-y-5 px-4"><Skeleton className="h-8" /><Skeleton className="aspect-video" /><Skeleton className="h-12" /></div>}>
        <Content params={params} />
      </Suspense>
    </>
  );
}

async function Content({ params }: { params: PageProps<"/organiser/events/[id]/edit">["params"] }) {
  await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [data, orgs, categories] = await Promise.all([getEventForEdit(id), getMyOrganisers(), listCategories()]);
  if (!data) notFound();
  const org = orgs.find((o) => o.id === data.event.organiser_id);
  if (!org) notFound();

  if (data.event.status === "cancelled" || data.event.status === "removed" || data.event.status === "expired") {
    return (
      <EmptyState
        title={data.event.status === "cancelled" ? "This event was cancelled" : "This event can't be edited"}
        action={<ButtonLink href={`/organiser?org=${org.id}`}>Back to Studio</ButtonLink>}
      >
        {data.event.cancel_reason ? `Reason: ${data.event.cancel_reason}` : "Only draft and live events can be edited."}
      </EmptyState>
    );
  }
  if (org.status !== "approved") {
    return <EmptyState title="Organiser not approved" action={<ButtonLink href="/organiser">Studio</ButtonLink>}>You can edit events once your organiser is approved.</EmptyState>;
  }

  return (
    <>
      <p className="-mt-2 mb-4 flex items-center gap-2 px-4 text-xs text-muted">
        {org.name} <Badge tone={data.event.status === "published" ? "success" : "neutral"}>{data.event.status === "published" ? "Live" : "Draft"}</Badge>
      </p>
      <EventEditor
        key={data.event.id}
        organiser={{ id: org.id, name: org.name, is_verified: org.is_verified, stripe_charges_enabled: org.stripe_charges_enabled }}
        categories={categories.map((c) => ({ id: c.id, name: c.name, group: c.group }))}
        initial={eventToForm(data.event, data.private, data.tickets, data.questions)}
        eventId={data.event.id}
        status={data.event.status}
        originalStartsAt={data.event.starts_at}
        registrations={data.registrations}
      />
    </>
  );
}
