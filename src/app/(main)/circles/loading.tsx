import { PageHeader } from "@/components/ui/PageHeader";
import { CirclesSkeleton } from "@/components/social/Skeletons";

export default function Loading() {
  return (
    <>
      <PageHeader title="Circles" subtitle="Small groups of friends: share events, see who's in, plan together." />
      <CirclesSkeleton tabs />
    </>
  );
}
