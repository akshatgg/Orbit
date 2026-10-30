import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinFrame, JoinInvite } from "@/components/social/JoinInvite";
import { JoinSkeleton } from "@/components/social/Skeletons";

export const metadata: Metadata = { title: "Join a channel", robots: { index: false, follow: false } };

export default function JoinChannelPage({ params }: PageProps<"/join/channel/[code]">) {
  return (
    <JoinFrame>
      <Suspense fallback={<JoinSkeleton />}>
        <Content params={params} />
      </Suspense>
    </JoinFrame>
  );
}

async function Content({ params }: { params: PageProps<"/join/channel/[code]">["params"] }) {
  const { code } = await params;
  return <JoinInvite code={code} kind="channel" />;
}
