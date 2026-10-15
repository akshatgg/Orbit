import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <>
      <PageHeader title="Search" subtitle="Find events by name, organiser, company or topic" />
      <ComingSoon>Search, filters (date, category, format, location, price) and sorting go here.</ComingSoon>
    </>
  );
}
