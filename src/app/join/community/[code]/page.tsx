import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinFrame, JoinInvite } from "@/components/social/JoinInvite";
import { JoinSkeleton } from "@/components/social/Skeletons";

export const metadata: Metadata = { title: "Join a community", robots: { index: false, follow: false } };

export default function JoinCommunityPage({ params }: PageProps<"/join/community/[code]">) {
  return (
    <JoinFrame>
      <Suspense fallback={<JoinSkeleton />}>
        <Content params={params} />
      </Suspense>
    </JoinFrame>
  );
}

async function Content({ params }: { params: PageProps<"/join/community/[code]">["params"] }) {
  const { code } = await params;
  return <JoinInvite code={code} kind="community" />;
}
