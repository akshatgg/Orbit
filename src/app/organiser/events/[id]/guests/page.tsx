import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import type { GuestFilter } from "@/lib/guests/filter";
import { getEventQuestions, getManagedEvent, listGuests } from "@/lib/guests/queries";
import { REGISTRATION_STATUSES } from "@/lib/guests/types";
import { buttonClass } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EventHeader, EventHeaderSkeleton, EventNav } from "@/components/guests/EventHeader";
import { GuestList } from "@/components/guests/GuestList";

export const metadata: Metadata = { title: "Guests" };

type Props = PageProps<"/organiser/events/[id]/guests">;

export default function Page({ params, searchParams }: Props) {
  return (
    <main className="pb-10">
      <Suspense fallback={<GuestsSkeleton />}>
        <Guests params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Guests({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  await requireUser();
  const { id } = await params;
  const event = await getManagedEvent(id);
  if (!event) notFound();

  const { status } = await searchParams;
  const valid: string[] = ["all", "checked_in", ...REGISTRATION_STATUSES];
  const initialStatus = (typeof status === "string" && valid.includes(status) ? status : "all") as GuestFilter;

  const [guests, questions] = await Promise.all([listGuests(id), getEventQuestions(id)]);
  const pending = guests.filter((g) => g.status === "pending").length;

  return (
    <>
      <EventHeader event={event} compact />
      <EventNav eventId={id} active="guests" pending={pending} />
      <div className="flex items-end justify-between gap-3 px-4 pb-3 pt-5">
        <div>
          <h2 className="font-display text-xl font-semibold tracking-wide">Guest list</h2>
          <p className="text-sm text-muted">
            {guests.length} {guests.length === 1 ? "registration" : "registrations"}
            {questions.length > 0 && ` · ${questions.length} application ${questions.length === 1 ? "question" : "questions"}`}
          </p>
        </div>
        {guests.length > 0 && (
          // A plain link: the route handler streams a file download.
          <a href={`/organiser/events/${id}/guests/export`} download className={buttonClass({ variant: "secondary", size: "sm", className: "shrink-0 whitespace-nowrap" })}>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
            </svg>
            Export CSV
          </a>
        )}
      </div>
      <GuestList key={initialStatus} eventId={id} guests={guests} questions={questions} initialStatus={initialStatus} />
    </>
  );
}

function GuestsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading guests">
      <EventHeaderSkeleton compact />
      <div className="space-y-3 px-4 pt-5">
        <Skeleton className="h-10" />
        <Skeleton className="h-10" />
        <div className="flex gap-2">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-8 w-20 rounded-full" />)}</div>
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
    </div>
  );
}
