import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { getProfile } from "@/lib/auth";
import { googleCalendarUrl } from "@/lib/calendar";
import { FORMAT_LABELS, formatDeadline, formatEventDate, formatLongDate, formatPrice, formatTimeRange, dayKey } from "@/lib/format";
import { appUrl, toCalendarEvent } from "@/lib/tickets/calendar";
import { STATUS_COPY, hasEnded, isActiveStatus, mapsUrl, paragraphs, safeHttpUrl, selectCta } from "@/lib/tickets/logic";
import { getEvent, getEventPageData, type EventPageData } from "@/lib/tickets/queries";
import { EventCover } from "@/components/events/EventCover";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";
import { SaveButton } from "@/components/events/SaveButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { EventActions } from "@/components/tickets/EventActions";
import { BackButton, CalendarButton, ExternalRegisteredToggle, ShareButton, SignInToSave, ViewLogger } from "@/components/tickets/EventExtras";
import { EventPageSkeleton } from "@/components/tickets/Skeletons";
import { CancelRegistrationButton, CompletePaymentButton } from "@/components/tickets/RegistrationButtons";
import { RichText } from "@/components/tickets/RichText";
import { Icon, type IconName } from "@/components/tickets/icons";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  await connection(); // data reads below are per request
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return { title: "Event not found" };

  const where = event.format === "online" ? "Online" : (event.venue_name ?? event.city ?? FORMAT_LABELS.in_person);
  const blurb = event.summary ?? paragraphs(event.description)[0]?.slice(0, 180) ?? "";
  const description = [`${formatEventDate(event.starts_at)} · ${where}`, blurb].filter(Boolean).join(" — ");
  const url = `${appUrl()}/events/${event.id}`;
  const image = safeHttpUrl(event.cover_url) ?? `${appUrl()}/brand/orbit-logo-full.png`;
  const title = event.status === "cancelled" ? `Cancelled: ${event.title}` : event.title;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "ORBIT",
      title,
      description,
      url,
      images: [{ url: image, alt: event.title }],
    },
    twitter: { card: event.cover_url ? "summary_large_image" : "summary", title, description, images: [image] },
  };
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto min-h-dvh max-w-md pb-40">
      <Suspense fallback={<EventPageSkeleton />}>
        <EventContent params={params} />
      </Suspense>
    </main>
  );
}

async function EventContent({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  // Registration state depends on the current time, so always render per request.
  await connection();
  const { id } = await params;
  const [data, viewer] = await Promise.all([getEventPageData(id), getProfile()]);
  if (!data) notFound();

  const { event, counts, spotsLeft, tickets, questions, registration, userId, canManage, privateInfo } = data;
  const signedIn = !!userId;
  const now = new Date();
  const ended = hasEnded(event, now);
  const cancelled = event.status === "cancelled";
  const cta = selectCta({ event, registrationStatus: registration?.status ?? null, tickets, questionCount: questions.length, now });
  const price = formatPrice(event.price_min, event.price_max, event.currency);
  const calendar = toCalendarEvent(event);
  const googleUrl = googleCalendarUrl(calendar);
  const usesTickets = event.registration_mode === "tickets";
  const full = usesTickets && spotsLeft !== null && spotsLeft <= 0;
  const deadline = event.registration_deadline;
  const deadlineOpen = deadline && new Date(deadline) > now;
  const sameDay = !event.ends_at || dayKey(event.ends_at) === dayKey(event.starts_at);
  const maps = event.format !== "online" ? mapsUrl([event.venue_name, event.address, event.city]) : null;
  const source = event.source !== "orbit" ? safeHttpUrl(event.source_url) : null;

  const goingLine = usesTickets
    ? [
        counts.going > 0 ? `${counts.going} going` : null,
        spotsLeft === null ? null : full ? (event.waitlist_enabled ? "Full · waitlist open" : "Full") : `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`,
      ].filter(Boolean).join(" · ") || null
    : null;
  const availabilityLine = full && event.waitlist_enabled
    ? "Full · join the waitlist"
    : spotsLeft !== null && spotsLeft <= 20
      ? `${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left`
      : deadlineOpen
        ? formatDeadline(deadline, now)
        : counts.going > 0 ? `${counts.going} going` : null;

  return (
    <>
      {/* Cover */}
      <div className="relative">
        <div className="aspect-[16/11] w-full overflow-hidden">
          <EventCover src={event.cover_url} title={event.title} className={cancelled ? "grayscale" : ""} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-bg/10" aria-hidden />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <BackButton />
          <div className="flex items-center gap-2">
            <ShareButton eventId={event.id} title={event.title} text={event.summary} />
            {signedIn ? (
              <SaveButton eventId={event.id} saved={data.saved} className="h-10 w-10 border-white/10 bg-bg/60 backdrop-blur-md" />
            ) : (
              <SignInToSave next={`/events/${event.id}`} />
            )}
          </div>
        </div>
      </div>

      <div className="relative -mt-14 space-y-6 px-4">
        {/* Status banners */}
        {cancelled && (
          <Banner tone="danger" icon="x" title="This event has been cancelled">
            {event.cancel_reason ?? "The organiser cancelled this event."}
          </Banner>
        )}
        {!cancelled && ended && <Banner tone="neutral" icon="clock" title="This event has ended">Hope it was a good one.</Banner>}
        {event.status !== "published" && event.status !== "cancelled" && canManage && (
          <Banner tone="warning" icon="info" title={event.status === "draft" ? "Draft preview" : `Preview · ${event.status}`}>
            Only your team can see this page until the event is published.
          </Banner>
        )}

        {/* Title */}
        <header>
          <div className="flex flex-wrap items-center gap-1.5">
            {event.category && <Badge tone="brand">{event.category.name}</Badge>}
            <Badge>{FORMAT_LABELS[event.format as keyof typeof FORMAT_LABELS] ?? event.format}</Badge>
            {registration && isActiveStatus(registration.status) && <RegistrationBadge status={registration.status} />}
          </div>
          <h1 className={`mt-3 font-display text-[28px] font-semibold leading-[1.15] tracking-tight ${cancelled ? "text-muted" : ""}`}>
            {event.title}
          </h1>
          {event.summary && <p className="mt-2 text-[15px] leading-relaxed text-muted">{event.summary}</p>}
        </header>

        {/* Organiser */}
        {event.organiser && (
          <Link
            href={`/o/${event.organiser.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface/70 p-3 transition-colors hover:border-violet/50"
          >
            <Avatar src={event.organiser.logo_url} name={event.organiser.name} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted">Hosted by</span>
              <span className="flex items-center gap-1.5 truncate font-medium">
                {event.organiser.name}
                {event.organiser.is_verified && <VerifiedMark />}
              </span>
            </span>
            <Icon name="chevron" className="h-4 w-4 text-muted" />
          </Link>
        )}

        {/* Key facts */}
        <section aria-label="Event details" className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          <InfoRow
            icon="calendar"
            title={formatLongDate(event.starts_at)}
            sub={sameDay
              ? `${formatTimeRange(event.starts_at, event.ends_at)} · UK time`
              : `${formatTimeRange(event.starts_at)} until ${formatEventDate(event.ends_at!)} · UK time`}
            action={!ended && !cancelled ? (
              <CalendarButton eventId={event.id} googleUrl={googleUrl} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-fg hover:border-violet/60">
                Add to calendar
              </CalendarButton>
            ) : null}
          />
          {event.format !== "online" && (event.venue_name || event.address) && (
            <InfoRow
              icon="pin"
              title={event.venue_name ?? event.address!}
              sub={[event.venue_name ? event.address : null, event.city].filter(Boolean).join(" · ") || null}
              action={maps ? (
                <a href={maps} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:border-violet/60">
                  Open in Maps
                </a>
              ) : null}
            />
          )}
          {event.format !== "in_person" && (
            <InfoRow
              icon="globe"
              title={event.format === "hybrid" ? "Hybrid · join online too" : "Online event"}
              sub={privateInfo?.online_url ? "Your joining link is below" : "Joining link is shared with confirmed guests"}
            />
          )}
          {(price || goingLine) && (
            <InfoRow icon="ticket" title={price ?? "Price not listed"} sub={goingLine} />
          )}
          {deadline && !ended && !cancelled && (
            <InfoRow
              icon="clock"
              title={deadlineOpen ? `Registration closes ${formatEventDate(deadline)}` : "Registration has closed"}
              sub={deadlineOpen ? formatDeadline(deadline, now) : null}
              tone={deadlineOpen ? undefined : "danger"}
            />
          )}
        </section>

        {/* Your registration */}
        {usesTickets && registration && isActiveStatus(registration.status) && !cancelled && (
          <section className="border-gradient glow rounded-2xl p-4" aria-labelledby="your-reg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="your-reg" className="font-display text-base font-semibold">{STATUS_COPY[registration.status].title}</h2>
                <p className="mt-1 text-sm text-muted">
                  {registration.status === "pending" ? "Request sent — the organiser will review it." : STATUS_COPY[registration.status].body}
                </p>
              </div>
              <RegistrationBadge status={registration.status} />
            </div>
            <div className="mt-4 space-y-3">
              {registration.status === "awaiting_payment" && !ended && <CompletePaymentButton registrationId={registration.id} />}
              <div className="flex items-center justify-between gap-3">
                <ButtonLink href={`/tickets/${registration.id}`} variant="secondary" size="md">
                  <Icon name="ticket" /> {registration.status === "going" ? "View ticket" : "View status"}
                </ButtonLink>
                {!ended && <CancelRegistrationButton eventId={event.id} eventTitle={event.title} status={registration.status} />}
              </div>
            </div>
          </section>
        )}

        {/* External registration */}
        {event.registration_mode === "external" && !cancelled && !ended && (
          <section className="flex items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Did you register?</p>
              <p className="mt-0.5 text-xs text-muted">Registration happens on the organiser&apos;s site. Mark it here to keep track.</p>
            </div>
            <ExternalRegisteredToggle eventId={event.id} registered={data.externalRegistered} signedIn={signedIn} />
          </section>
        )}

        {/* Guest-only details */}
        {privateInfo && !cancelled && (
          <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4" aria-labelledby="guest-info">
            <h2 id="guest-info" className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Icon name="check" /> For guests
            </h2>
            {privateInfo.guest_info && <RichText text={privateInfo.guest_info} className="mt-2 text-sm" />}
            {safeHttpUrl(privateInfo.online_url) && (
              <a
                href={safeHttpUrl(privateInfo.online_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-fg px-4 py-3 text-sm font-semibold text-bg"
              >
                <Icon name="video" /> Join online
              </a>
            )}
          </section>
        )}

        {/* About */}
        {event.description && (
          <section aria-labelledby="about">
            <h2 id="about" className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.3em] text-muted">About</h2>
            <RichText text={event.description} />
          </section>
        )}

        {event.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Tags">
            {event.tags.map((t) => (
              <li key={t} className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-muted">#{t}</li>
            ))}
          </ul>
        )}

        {source && (
          <p className="text-xs text-muted">
            Listed from{" "}
            <a href={source} target="_blank" rel="noopener noreferrer nofollow" className="text-fg underline underline-offset-2">
              {new URL(source).hostname}
            </a>
          </p>
        )}

        {canManage && (
          <ButtonLink href={`/organiser/events/${event.id}`} variant="secondary" full>
            Manage event
          </ButtonLink>
        )}
      </div>

      <EventActions
        eventId={event.id}
        eventTitle={event.title}
        dateLabel={formatEventDate(event.starts_at)}
        cta={cta}
        signedIn={signedIn}
        onboarded={!!viewer?.onboarded_at}
        tickets={tickets}
        questions={questions}
        requiresApproval={event.requires_approval}
        waitlistEnabled={event.waitlist_enabled}
        priceLabel={price}
        availabilityLine={availabilityLine}
        registrationId={registration && registration.status !== "cancelled" ? registration.id : null}
        googleCalendarUrl={googleUrl}
      />
      <ViewLogger eventId={event.id} />
    </>
  );
}

function InfoRow({ icon, title, sub, action, tone }: {
  icon: IconName; title: string; sub?: string | null; action?: ReactNode; tone?: "danger";
}) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line ${tone === "danger" ? "bg-red-500/10 text-red-300" : "bg-surface-2 text-pink"}`}>
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-snug">{title}</p>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

function Banner({ tone, icon, title, children }: { tone: "danger" | "warning" | "neutral"; icon: IconName; title: string; children: ReactNode }) {
  const tones = {
    danger: "border-red-500/40 bg-red-950/70 text-red-200",
    warning: "border-orange/40 bg-[#2a1a08]/90 text-orange",
    neutral: "border-line bg-surface-2/95 text-fg",
  } as const;
  return (
    <div role="status" className={`flex gap-3 rounded-2xl border p-4 backdrop-blur-md ${tones[tone]}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm opacity-80">{children}</p>
      </div>
    </div>
  );
}

export type { EventPageData };
