import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "discovery" feature.
export default function Page() {
  return (
    <>
      <PageHeader title="This Week" subtitle="Your shortlist for the next 7 days" />
      <Placeholder>Top picks · Career &amp; academic · Social &amp; community · Other interests.</Placeholder>
    </>
  );
}
