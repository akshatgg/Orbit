import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

export default function ForYouPage() {
  return (
    <>
      <PageHeader title="For You" subtitle="Events ranked for your goals and interests" />
      <ComingSoon>Your ranked feed will appear here, each with a “Recommended because…” reason.</ComingSoon>
    </>
  );
}
