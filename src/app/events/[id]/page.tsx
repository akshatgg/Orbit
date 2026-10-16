import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { getProfile } from "@/lib/auth";
import { googleCalendarUrl } from "@/lib/calendar";
import { FORMAT_LABELS, formatDeadline, formatEventDate, formatLongDate, formatPrice, formatTimeRange, dayKey } from "@/lib/format";
import { absoluteUrl } from "@/lib/seo/site";
import { buildEventJsonLd } from "@/lib/seo/jsonld";
import { JsonLd } from "@/components/seo/JsonLd";
import { toCalendarEvent } from "@/lib/tickets/calendar";
import { STATUS_COPY, hasEnded, isActiveStatus, mapsUrl, paragraphs, safeHttpUrl, selectCta } from "@/lib/tickets/logic";
import { getEvent, getEventPageData, type EventPageData } from "@/lib/tickets/queries";
import { EventCover } from "@/components/events/EventCover";
import { RegistrationBadge } from "@/components/events/RegistrationBadge";
import { SaveButton } from "@/components/events/SaveButton";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, VerifiedMark } from "@/components/ui/Badge";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
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
  const url = absoluteUrl(`/events/${event.id}`);
  // Without a cover, the generated image (opengraph-image.tsx) is used.
  const image = safeHttpUrl(event.cover_url);
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
      ...(image ? { images: [{ url: image, alt: event.title }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description, ...(image ? { images: [image] } : {}) },
  };
}

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto min-h-dvh max-w-md pb-40 md:max-w-3xl lg:max-w-6xl lg:px-6 lg:pb-16">
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

  const hasTail = !!event.description || event.tags.length > 0 || !!source || canManage;

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

  const jsonLd = buildEventJsonLd({ ...event, soldOut: full && !event.waitlist_enabled });

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-[auto_auto_1fr] lg:gap-x-10 lg:pt-6">
      {/* Cover */}
      <div className="relative lg:col-start-1 lg:row-start-1">
        <div className="aspect-[4/3] w-full overflow-hidden [mask-image:linear-gradient(to_bottom,#000_50%,transparent_100%)] md:aspect-[16/9] lg:aspect-[16/9] lg:rounded-[28px] lg:[mask-image:none]">
          <EventCover src={event.cover_url} title={event.title} className={cancelled ? "grayscale" : ""} />
        </div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-transparent lg:rounded-[28px]" aria-hidden />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] lg:pt-4">
          <BackButton />
          <div className="flex items-center gap-2">
            <ShareButton eventId={event.id} title={event.title} text={event.summary} />
            {signedIn ? (
              <SaveButton eventId={event.id} saved={data.saved} className="h-10 w-10" />
            ) : (
              <SignInToSave next={`/events/${event.id}`} />
            )}
          </div>
        </div>
      </div>

      <div className="relative -mt-16 space-y-5 px-4 lg:contents">
        <div className="space-y-5 lg:col-start-1 lg:row-start-2 lg:mb-5 lg:mt-5">
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
          <h1 className={`mt-3 text-[1.75rem] font-semibold leading-[1.15] tracking-tight ${cancelled ? "text-muted" : ""}`}>
            {event.title}
          </h1>
          {event.summary && <p className="mt-2 text-[15px] leading-relaxed text-muted">{event.summary}</p>}
        </header>

        {/* Organiser */}
        {event.organiser && (
          <Link
            href={`/o/${event.organiser.slug}`}
            className="glass flex items-center gap-3 rounded-[22px] p-3 transition duration-200 hover:bg-white/[0.08] motion-reduce:transition-none"
          >
            <Avatar src={event.organiser.logo_url} name={event.organiser.name} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-subtle">Hosted by</span>
              <span className="flex items-center gap-1.5 truncate font-medium">
                {event.organiser.name}
                {event.organiser.is_verified && <VerifiedMark />}
              </span>
            </span>
            <Icon name="chevron" className="h-4 w-4 text-muted" />
          </Link>
        )}

        </div>

        <div className="space-y-5 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:flex lg:flex-col lg:space-y-0 lg:gap-5 lg:self-start lg:sticky lg:top-6">
        <div className="contents lg:block">
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
        </div>
        {/* Key facts */}
        <section aria-label="Event details" className="glass divide-y divide-white/[0.07] overflow-hidden rounded-[22px]">
          <InfoRow
            icon="calendar"
            title={formatLongDate(event.starts_at)}
            sub={sameDay
              ? `${formatTimeRange(event.starts_at, event.ends_at)} · UK time`
              : `${formatTimeRange(event.starts_at)} until ${formatEventDate(event.ends_at!)} · UK time`}
            action={!ended && !cancelled ? (
              <CalendarButton eventId={event.id} googleUrl={googleUrl} className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-fg transition-colors hover:bg-white/[0.12]">
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
                <a href={maps} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-white/[0.12]">
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
          <section className="border-gradient glow rounded-[22px] p-4" aria-labelledby="your-reg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="your-reg" className="text-base font-semibold tracking-tight">{STATUS_COPY[registration.status].title}</h2>
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
          <section className="glass flex items-center justify-between gap-4 rounded-[22px] p-4">
            <div className="min-w-0">
              <p className="text-sm font-medium">Did you register?</p>
              <p className="mt-0.5 text-xs text-muted">Registration happens on the organiser&apos;s site. Mark it here to keep track.</p>
            </div>
            <ExternalRegisteredToggle eventId={event.id} registered={data.externalRegistered} signedIn={signedIn} />
          </section>
        )}

        {/* Guest-only details */}
        {privateInfo && !cancelled && (
          <section className="rounded-[22px] border border-emerald-400/20 bg-emerald-400/[0.06] p-4 backdrop-blur-xl" aria-labelledby="guest-info">
            <h2 id="guest-info" className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <Icon name="check" /> For guests
            </h2>
            {privateInfo.guest_info && <RichText text={privateInfo.guest_info} className="mt-2 text-sm" />}
            {safeHttpUrl(privateInfo.online_url) && (
              <a
                href={safeHttpUrl(privateInfo.online_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass({ full: true, className: "mt-3" })}
              >
                <Icon name="video" /> Join online
              </a>
            )}
          </section>
        )}

        </div>

        {hasTail && (
        <div className="space-y-5 lg:col-start-1 lg:row-start-3">
        {/* About */}
        {event.description && (
          <section aria-labelledby="about">
            <h2 id="about" className="mb-3 font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-subtle">About</h2>
            <RichText text={event.description} />
          </section>
        )}

        {event.tags.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Tags">
            {event.tags.map((t) => (
              <li key={t} className="glass rounded-full px-3 py-1 text-xs text-muted">#{t}</li>
            ))}
          </ul>
        )}

        {source && (
          <p className="text-xs text-muted">
            Listed from{" "}
            <a href={source} target="_blank" rel="noopener noreferrer nofollow" className="text-fg/90 underline decoration-white/30 underline-offset-2">
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
        )}
      </div>
      </div>

      <ViewLogger eventId={event.id} />
    </>
  );
}

function InfoRow({ icon, title, sub, action, tone }: {
  icon: IconName; title: string; sub?: string | null; action?: ReactNode; tone?: "danger";
}) {
  return (
    <div className="flex items-center gap-3 p-3.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border ${tone === "danger" ? "border-red-400/20 bg-red-500/10 text-red-300" : "border-white/10 bg-white/[0.06] text-accent"}`}>
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
    danger: "border-red-400/25 bg-red-500/10 text-red-200",
    warning: "border-orange/25 bg-orange/10 text-orange",
    neutral: "border-white/10 bg-white/[0.06] text-fg",
  } as const;
  return (
    <div role="status" className={`flex gap-3 rounded-[22px] border p-4 backdrop-blur-xl ${tones[tone]}`}>
      <Icon name={icon} className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm opacity-80">{children}</p>
      </div>
    </div>
  );
}

export type { EventPageData };
