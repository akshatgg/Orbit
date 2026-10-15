import { PageHeader } from "@/components/ui/PageHeader";
import { Placeholder } from "@/components/ui/Placeholder";

// Built by the "onboarding-profile" feature.
export default function OnboardingPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <PageHeader title="Welcome to ORBIT" subtitle="Tell us what you're looking for" />
      <Placeholder>Onboarding steps.</Placeholder>
    </main>
  );
}
