import { DirectorySkeleton } from "@/components/social/Skeletons";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Loading() {
  return (
    <>
      <PageHeader title="Communities" subtitle="Interest groups across ORBIT: join one to see its events and announcements." />
      <DirectorySkeleton tabs />
    </>
  );
}
