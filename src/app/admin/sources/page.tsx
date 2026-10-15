import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "event-sources" feature.
export default function Page() {
  return (
    <>
      <PageHeader title="Sources" subtitle="Automatic event feeds" />
      <Placeholder>Feeds, refresh status and duplicates.</Placeholder>
    </>
  );
}
