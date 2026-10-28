import { ConversationsSkeleton } from "@/components/social/Skeletons";
import { PageHeader } from "@/components/ui/PageHeader";

export default function Loading() {
  return (
    <>
      <PageHeader title="Messages" subtitle="Circle chats and direct messages with people you share a circle or community with." />
      <ConversationsSkeleton />
    </>
  );
}
