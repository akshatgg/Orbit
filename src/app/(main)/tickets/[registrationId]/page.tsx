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
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { getProfile, requireUser } from "@/lib/auth";
import { SetupNudge } from "@/components/profile/SetupNudge";
import { googleCalendarUrl } from "@/lib/calendar";
import { FORMAT_LABELS, formatLongDate, formatPrice, formatTimeRange } from "@/lib/format";
import { toCalendarEvent } from "@/lib/tickets/calendar";
import { STATUS_COPY, formatTicketCode, hasEnded, mapsUrl, safeHttpUrl } from "@/lib/tickets/logic";
import { getMyTicket } from "@/lib/tickets/queries";

export const metadata: Metadata = { title: "Ticket" };

export default function Page({ params }: PageProps<"/tickets/[registrationId]">) {
  return (
    <Suspense fallback={<PassSkeleton />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: PageProps<"/tickets/[registrationId]">["params"] }) {
  // Signed in is enough: someone can register for a first event before finishing setup.
  const user = await requireUser();
  const { registrationId } = await params;
  const [found, profile] = await Promise.all([getMyTicket(user.id, registrationId), getProfile()]);
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
    <div className="space-y-5 px-4 pb-28 pt-[var(--page-top,max(env(safe-area-inset-top),1.25rem))] md:mx-auto md:max-w-xl lg:grid lg:max-w-none lg:grid-cols-[28rem_minmax(0,1fr)] lg:grid-rows-[auto_auto_1fr] lg:gap-x-10 lg:pb-8 lg:pt-8">
      <Link href="/tickets" className="glass inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3.5 text-sm text-muted transition-colors duration-200 hover:text-fg lg:col-span-2 lg:justify-self-start">
        <Icon name="back" /> My Tickets
      </Link>

      {cancelledEvent && (
        <div role="status" className="rounded-[22px] border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200 lg:col-start-1 lg:row-start-2">
          <p className="font-semibold">This event has been cancelled</p>
          {event.cancel_reason && <p className="mt-0.5 opacity-80">{event.cancel_reason}</p>}
        </div>
      )}

      <article className={`glass overflow-hidden rounded-[28px] lg:col-start-1 lg:row-start-3 lg:self-start`} aria-label="Ticket">
        <div className="relative p-5">
          <div className="relative flex items-start justify-between gap-3">
            <p className="font-display text-xs font-medium text-muted">ORBIT ticket</p>
            <RegistrationBadge status={t.status} />
          </div>
          <h1 className="relative mt-3 text-2xl font-semibold leading-tight tracking-tight">
            <Link href={`/events/${event.id}`} className="hover:underline">{event.title}</Link>
          </h1>
          {event.organiser && (
            <p className="relative mt-1 flex items-center gap-1.5 text-sm text-muted">
              {event.organiser.name}
              {event.organiser.is_verified && <VerifiedMark />}
            </p>
          )}
        </div>

        <div className="mx-5 border-t border-dashed border-ink/15" aria-hidden />

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
            <div className="rounded-[18px] border border-ink/10 bg-ink/[0.05] p-4 text-center">
              <p className="text-base font-semibold tracking-tight">{cancelledEvent ? "Event cancelled" : copy.title}</p>
              <p className="mt-1 text-sm text-muted">{cancelledEvent ? "This ticket is no longer valid." : copy.body}</p>
            </div>
          )}

          {t.status === "awaiting_payment" && !ended && !cancelledEvent && (
            <div className="mt-4"><CompletePaymentButton registrationId={t.id} /></div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-ink/[0.07] bg-ink/[0.025] p-5 text-sm">
          <Detail label="Date">{formatLongDate(event.starts_at)}</Detail>
          <Detail label="Time">{formatTimeRange(event.starts_at, event.ends_at)}</Detail>
          <Detail label="Where" wide>
            {where ?? FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS]}
            {maps && <> · <a href={maps} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">Map</a></>}
          </Detail>
          {t.ticket && <Detail label="Ticket">{t.ticket.name}</Detail>}
          {price && <Detail label="Price">{price}</Detail>}
        </dl>
      </article>

      <div className="space-y-5 lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:max-w-md lg:self-start">
      {privateInfo && t.status === "going" && !cancelledEvent && (
        <section className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4" aria-labelledby="guest-info">
          <h2 id="guest-info" className="flex items-center gap-2 text-sm font-semibold text-emerald-300"><Icon name="check" /> For guests</h2>
          {privateInfo.guest_info && <p className="mt-2 whitespace-pre-line text-sm">{privateInfo.guest_info}</p>}
          {joinUrl && (
            <a href={joinUrl} target="_blank" rel="noopener noreferrer" className={buttonClass({ full: true, className: "mt-3" })}>
              <Icon name="video" /> Join online
            </a>
          )}
        </section>
      )}

      {!profile?.onboarded_at && <SetupNudge next={`/tickets/${t.id}`} />}

      <div className="grid gap-2">
        {!ended && !cancelledEvent && (
          <CalendarButton
            eventId={event.id}
            googleUrl={googleCalendarUrl(calendar)}
            className={buttonClass({ variant: "secondary", size: "lg", full: true })}
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
    </div>
  );
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
