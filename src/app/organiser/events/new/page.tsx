import type { Metadata } from "next";
import { Suspense } from "react";
import { EventEditor } from "@/components/organiser/EventEditor";
import { BackLink } from "@/components/nav/BackLink";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { getMyOrganisers, requireUser } from "@/lib/auth";
import { listCategories } from "@/lib/events/queries";
import { emptyEventForm } from "@/lib/organiser/event-form";
import { pickOrganiser } from "@/lib/organiser/dashboard";

export const metadata: Metadata = { title: "New event" };

export default function NewEventPage({ searchParams }: PageProps<"/organiser/events/new">) {
  return (
    <>
      <PageHeader back={<BackLink href="/organiser" label="Studio" />} title="New event" />
      <Suspense fallback={<EditorSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/organiser/events/new">["searchParams"] }) {
  await requireUser();
  const [orgs, params, categories] = await Promise.all([getMyOrganisers(), searchParams, listCategories()]);
  const org = pickOrganiser(orgs, params.org);
  if (!org) {
    return (
      <EmptyState title="You need an approved organiser" action={<ButtonLink href="/organiser">Go to Studio</ButtonLink>}>
        Events are published by approved organisers. Check the status of your application in Studio.
      </EmptyState>
    );
  }
  return (
    <>
      <p className="-mt-2 mb-4 px-4 text-xs text-muted">Publishing as {org.name}</p>
      <EventEditor
        key={org.id}
        organiser={{ id: org.id, name: org.name, is_verified: org.is_verified, stripe_charges_enabled: org.stripe_charges_enabled }}
        categories={categories.map((c) => ({ id: c.id, name: c.name, group: c.group }))}
        initial={emptyEventForm()}
      />
    </>
  );
}

function EditorSkeleton() {
  return (
    <div className="space-y-5 px-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8" />
      <Skeleton className="aspect-video" />
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}
    </div>
  );
}
