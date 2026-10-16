import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { formatEventDate } from "@/lib/format";
import { getCheckInCount, getManagedEvent, listGuests } from "@/lib/guests/queries";
import { BackLink } from "@/components/nav/BackLink";
import { Eyebrow } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import { CheckInStation, type DoorGuest } from "@/components/guests/CheckInStation";

export const metadata: Metadata = { title: "Check-in" };

export default function Page({ params }: PageProps<"/organiser/events/[id]/check-in">) {
  return (
    <main className="pb-10">
      <Suspense fallback={<CheckInSkeleton />}>
        <CheckIn params={params} />
      </Suspense>
    </main>
  );
}

async function CheckIn({ params }: { params: PageProps<"/organiser/events/[id]/check-in">["params"] }) {
  await requireUser();
  const { id } = await params;
  const event = await getManagedEvent(id);
  if (!event) notFound();

  const [guests, counts] = await Promise.all([listGuests(id), getCheckInCount(id)]);
  const doorGuests: DoorGuest[] = guests
    .filter((g) => g.status !== "cancelled")
    .map(({ id: gid, name, email, ticket, status, checkedInAt }) => ({ id: gid, name, email, ticket, status, checkedInAt }));

  return (
    <>
      <header className="flex items-center gap-3 px-4 pb-4 pt-4">
        <BackLink href={`/organiser/events/${id}`} label="Event" />
        <div className="min-w-0">
          <Eyebrow>Door check-in</Eyebrow>
          <h1 className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight">{event.title}</h1>
          <p className="truncate text-xs text-muted">{formatEventDate(event.starts_at)}</p>
        </div>
      </header>
      <CheckInStation eventId={id} counts={counts} guests={doorGuests} />
    </>
  );
}

function CheckInSkeleton() {
  return (
    <div className="space-y-5 px-4 pt-4" aria-busy="true" aria-label="Loading check-in">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-20 rounded-full" />
        <div className="flex-1 space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-5 w-2/3" /></div>
      </div>
      <Skeleton className="h-12" />
      <Skeleton className="aspect-[3/4] max-h-[62dvh] w-full rounded-[28px]" />
      <Skeleton className="h-28" />
    </div>
  );
}
