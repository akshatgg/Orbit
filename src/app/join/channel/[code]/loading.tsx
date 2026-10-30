import { JoinFrame } from "@/components/social/JoinInvite";
import { JoinSkeleton } from "@/components/social/Skeletons";

export default function Loading() {
  return (
    <JoinFrame>
      <JoinSkeleton />
    </JoinFrame>
  );
}
