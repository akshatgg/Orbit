import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "event-tickets" feature.
export default function Page() {
  return (
    <>
      <PageHeader title="My Tickets" subtitle="QR tickets for events you're going to" />
      <Placeholder>Upcoming and past tickets with QR codes.</Placeholder>
    </>
  );
}
