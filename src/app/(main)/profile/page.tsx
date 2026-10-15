import type { Metadata } from "next";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title="Profile" subtitle="Your interests, preferences and saved events" />
      <ComingSoon>Edit preferences, see saved / attended / not-interested events.</ComingSoon>
    </>
  );
}
