import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "event-tickets" feature.
export default function EventPage() {
  return (
    <main className="mx-auto max-w-md">
      <PageHeader title="Event" />
      <Placeholder>Event details and registration.</Placeholder>
    </main>
  );
}
