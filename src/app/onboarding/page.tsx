import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-md">
      <PageHeader title="Welcome to ORBIT" subtitle="Tell us what you're looking for" />
      <ComingSoon>
        5 steps: university &amp; course → career interests → personal interests → event types &amp;
        format → availability (optional).
      </ComingSoon>
    </main>
  );
}
