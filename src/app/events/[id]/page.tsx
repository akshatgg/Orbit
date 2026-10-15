import { Suspense } from "react";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

async function EventDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ComingSoon>
      Event {id}: details, “Register” (opens the original page), save and add-to-calendar.
    </ComingSoon>
  );
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto max-w-md">
      <PageHeader title="Event" />
      <Suspense fallback={<ComingSoon>Loading…</ComingSoon>}>
        <EventDetails params={params} />
      </Suspense>
    </main>
  );
}
