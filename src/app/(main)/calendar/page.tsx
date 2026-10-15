import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  return (
    <>
      <PageHeader title="Calendar" subtitle="Saved and registered events by day" />
      <ComingSoon>Your saved and registered events will show here by day.</ComingSoon>
    </>
  );
}
