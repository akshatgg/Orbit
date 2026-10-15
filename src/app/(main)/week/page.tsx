import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "This Week" };

export default function WeekPage() {
  return (
    <>
      <PageHeader title="This Week" subtitle="Your shortlist for the next 7 days" />
      <ComingSoon>Top picks · Career &amp; academic · Social &amp; community · Other interests</ComingSoon>
    </>
  );
}
