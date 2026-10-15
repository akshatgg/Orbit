import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { QrCode } from "@/components/tickets/QrCode";
import { Icon } from "@/components/tickets/icons";
import { CancelRegistrationButton, CompletePaymentButton } from "@/components/tickets/RegistrationButtons";
import { CalendarButton } from "@/components/tickets/EventExtras";
import { PassSkeleton } from "@/components/tickets/Skeletons";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";
import { VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { requireProfile } from "@/lib/auth";
import { googleCalendarUrl } from "@/lib/calendar";
import { FORMAT_LABELS, formatLongDate, formatPrice, formatTimeRange } from "@/lib/format";
import { toCalendarEvent } from "@/lib/tickets/calendar";
import { STATUS_COPY, formatTicketCode, hasEnded, mapsUrl, safeHttpUrl } from "@/lib/tickets/logic";
import { getMyTicket } from "@/lib/tickets/queries";

export const metadata: Metadata = { title: "Ticket" };

// One sample id lets the shared layout (tab bar reads the pathname) prerender; real ids render on demand.
export function generateStaticParams() {
  return [{ registrationId: "00000000-0000-4000-8000-000000000000" }];
}

export default function Page({ params }: PageProps<"/tickets/[registrationId]">) {
  return (
    <Suspense fallback={<PassSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/tickets/[registrationId]">["params"] }) {
  const profile = await requireProfile();
  const { registrationId } = await params;
  const found = await getMyTicket(profile.id, registrationId);
  if (!found) notFound();
  const { ticket: t, privateInfo } = found;
  const { event } = t;

  const now = new Date();
  const ended = hasEnded(event, now);
  const cancelledEvent = event.status === "cancelled";
  const live = t.status === "going" && !cancelledEvent && !!t.qr_code;
  const copy = STATUS_COPY[t.status];
  const price = t.ticket ? (t.ticket.price > 0 ? formatPrice(t.ticket.price, t.ticket.price, t.ticket.currency) : "Free") : null;
  const calendar = toCalendarEvent(event);
  const where = event.format === "online"
    ? "Online"
    : [event.venue_name, event.address].filter(Boolean).join(", ") || event.city;
  const maps = event.format !== "online" ? mapsUrl([event.venue_name, event.address, event.city]) : null;
  const joinUrl = safeHttpUrl(privateInfo?.online_url);
  const canCancel = !ended && !cancelledEvent && ["going", "pending", "waitlisted", "awaiting_payment"].includes(t.status);

  return (
    <div className="space-y-5 px-4 pb-28 pt-[max(env(safe-area-inset-top),1.25rem)]">
      <Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg">
        <Icon name="back" /> My Tickets
      </Link>

      {cancelledEvent && (
        <div role="status" className="rounded-2xl border border-red-500/40 bg-red-950/70 p-4 text-sm text-red-200">
          <p className="font-semibold">This event has been cancelled</p>
          {event.cancel_reason && <p className="mt-0.5 opacity-80">{event.cancel_reason}</p>}
        </div>
      )}

      <article className={`border-gradient ${live && !ended ? "glow" : ""} overflow-hidden rounded-3xl bg-surface`} aria-label="Ticket">
        <div className="relative p-5">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient opacity-10" aria-hidden />
          <div className="relative flex items-start justify-between gap-3">
            <p className="font-display text-[11px] font-semibold uppercase tracking-[0.3em] text-muted">ORBIT ticket</p>
            <RegistrationBadge status={t.status} />
          </div>
          <h1 className="relative mt-3 font-display text-2xl font-semibold leading-tight tracking-tight">
            <Link href={`/events/${event.id}`} className="hover:underline">{event.title}</Link>
          </h1>
          {event.organiser && (
            <p className="relative mt-1 flex items-center gap-1.5 text-sm text-muted">
              {event.organiser.name}
              {event.organiser.is_verified && <VerifiedMark />}
            </p>
          )}
        </div>

        <div className="relative flex items-center" aria-hidden>
          <span className="-ml-3 h-6 w-6 rounded-full bg-bg" />
          <span className="flex-1 border-t border-dashed border-line" />
          <span className="-mr-3 h-6 w-6 rounded-full bg-bg" />
        </div>

        <div className="p-5">
          {live ? (
            <div className={ended || t.checked_in_at ? "opacity-60" : ""}>
              <QrCode value={t.qr_code!} label={`QR code for your ticket to ${event.title}`} />
              <p className="mt-3 text-center font-mono text-sm tracking-widest text-muted">{formatTicketCode(t.qr_code!)}</p>
              <p className="mt-1 text-center text-xs text-muted">
                {t.checked_in_at ? "Checked in. Enjoy the event!" : copy.body}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface-2 p-4 text-center">
              <p className="font-display text-base font-semibold">{cancelledEvent ? "Event cancelled" : copy.title}</p>
              <p className="mt-1 text-sm text-muted">{cancelledEvent ? "This ticket is no longer valid." : copy.body}</p>
            </div>
          )}

          {t.status === "awaiting_payment" && !ended && !cancelledEvent && (
            <div className="mt-4"><CompletePaymentButton registrationId={t.id} /></div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-line p-5 text-sm">
          <Detail label="Date">{formatLongDate(event.starts_at)}</Detail>
          <Detail label="Time">{formatTimeRange(event.starts_at, event.ends_at)}</Detail>
          <Detail label="Where" wide>
            {where ?? FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS]}
            {maps && <> · <a href={maps} target="_blank" rel="noopener noreferrer" className="text-pink underline underline-offset-2">Map</a></>}
          </Detail>
          {t.ticket && <Detail label="Ticket">{t.ticket.name}</Detail>}
          {price && <Detail label="Price">{price}</Detail>}
        </dl>
      </article>

      {privateInfo && t.status === "going" && !cancelledEvent && (
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4" aria-labelledby="guest-info">
          <h2 id="guest-info" className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Icon name="check" /> For guests</h2>
          {privateInfo.guest_info && <p className="mt-2 whitespace-pre-line text-sm">{privateInfo.guest_info}</p>}
          {joinUrl && (
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg">
              <Icon name="video" /> Join online
            </a>
          )}
        </section>
      )}

      <div className="grid gap-2">
        {!ended && !cancelledEvent && (
          <CalendarButton
            eventId={event.id}
            googleUrl={googleCalendarUrl(calendar)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-semibold hover:bg-surface-2"
          />
        )}
        <ButtonLink href={`/events/${event.id}`} variant="secondary" size="lg" full>View event page</ButtonLink>
        {canCancel && (
          <div className="pt-2 text-center">
            <CancelRegistrationButton eventId={event.id} eventTitle={event.title} status={t.status} />
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
