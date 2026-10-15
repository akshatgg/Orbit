import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "discovery" feature.
export default function Page() {
  return (
    <>
      <PageHeader title="For You" subtitle="Events ranked for your goals and interests" />
      <Placeholder>Ranked feed with “Recommended because…” reasons.</Placeholder>
    </>
  );
}
