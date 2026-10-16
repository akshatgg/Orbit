import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";
import { EventCover } from "@/components/events/EventCover";
import { TicketsSkeleton } from "@/components/tickets/Skeletons";
import { Icon } from "@/components/tickets/icons";
import { requireUser } from "@/lib/auth";
import { formatEventDate } from "@/lib/format";
import { splitTickets } from "@/lib/tickets/logic";
import { listMyTickets, type TicketRow } from "@/lib/tickets/queries";

export const metadata = { title: "My Tickets" };

export default function Page({ searchParams }: PageProps<"/tickets">) {
  return (
    <>
      <PageHeader title="My Tickets" subtitle="QR tickets for events you're going to" />
      <Suspense fallback={<TicketsSkeleton />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/tickets">["searchParams"] }) {
  // Signed in is enough: someone can register for a first event before finishing setup.
  const user = await requireUser();
  const { tab } = await searchParams;
  const { upcoming, past } = splitTickets(await listMyTickets(user.id));
  const showPast = tab === "past";
  const rows = showPast ? past : upcoming;

  return (
    <div className="space-y-4 pb-28">
      <nav aria-label="Ticket filter" className="mx-4 flex gap-1 rounded-xl border border-line bg-surface p-1">
        {[
          { href: "/tickets", label: `Upcoming (${upcoming.length})`, active: !showPast },
          { href: "/tickets?tab=past", label: `Past (${past.length})`, active: showPast },
        ].map((t) => (
          <Link
            key={t.href}
            href={t.href}
            replace
            aria-current={t.active ? "page" : undefined}
            className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium transition-colors ${t.active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          title={showPast ? "No past tickets" : "No upcoming tickets"}
          action={!showPast ? <ButtonLink href="/search">Find events</ButtonLink> : undefined}
        >
          {showPast ? "Events you've attended will show up here." : "Register for an event and your ticket will live here."}
        </EmptyState>
      ) : (
        <ul className="space-y-3 px-4">
          {rows.map((r) => <li key={r.id}><TicketCard row={r} past={showPast} /></li>)}
        </ul>
      )}
    </div>
  );
}

function TicketCard({ row, past }: { row: TicketRow; past: boolean }) {
  const { event } = row;
  const cancelled = event.status === "cancelled";
  return (
    <Link
      href={`/tickets/${row.id}`}
      className={`flex gap-3 rounded-2xl border bg-surface p-3 transition-colors hover:border-violet/50 ${row.status === "going" && !past ? "border-gradient" : "border-line"} ${past ? "opacity-80" : ""}`}
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        <EventCover src={event.cover_url} title={event.title} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-pink">{formatEventDate(event.starts_at)}</p>
        <h2 className={`mt-0.5 line-clamp-2 font-semibold leading-snug ${cancelled ? "text-muted line-through" : ""}`}>{event.title}</h2>
        {event.organiser && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
            {event.organiser.name}
            {event.organiser.is_verified && <VerifiedMark className="h-3.5 w-3.5 text-[8px]" />}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {cancelled && <Badge tone="danger">Event cancelled</Badge>}
          <RegistrationBadge status={row.status} />
          {row.ticket && <Badge>{row.ticket.name}</Badge>}
          {row.checked_in_at && <Badge tone="success">Checked in</Badge>}
        </div>
      </div>
      <Icon name="chevron" className="h-4 w-4 shrink-0 self-center text-muted" />
    </Link>
  );
}
