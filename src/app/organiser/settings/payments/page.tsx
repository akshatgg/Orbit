import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "payments" feature.
export default function Page() {
  return (
    <>
      <PageHeader title="Payments" subtitle="Get paid for tickets" />
      <Placeholder>Connect a payout account to sell paid tickets.</Placeholder>
    </>
  );
}
