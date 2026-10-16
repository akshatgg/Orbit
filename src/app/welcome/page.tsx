import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { OrbitEmblem } from "@/components/brand/OrbitEmblem";
import { EventCover } from "@/components/events/EventCover";
import { InstallButton } from "@/components/pwa/InstallButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { ButtonLink } from "@/components/ui/Button";
import { FORMAT_LABELS, formatEventDate, formatPrice } from "@/lib/format";
import { buildSiteJsonLd } from "@/lib/seo/jsonld";
import { listLandingEvents } from "@/lib/seo/public-data";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/seo/site";

// Served at "/" for signed-out visitors (the proxy rewrites "/" here). Canonical is always "/".
export const metadata: Metadata = {
  title: { absolute: SITE_TITLE },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "ORBIT", locale: "en_GB", url: "/", title: SITE_TITLE, description: SITE_DESCRIPTION, images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_TITLE }] },
};

const STEPS = [
  { title: "Tell us what you want", body: "Pick your goals and interests in under a minute — careers, networking, socials or all three." },
  { title: "Get a feed that fits", body: "Events are ranked for you and your week, so the good ones don't slip past." },
  { title: "Book in one tap", body: "Free and paid tickets, QR check-in and calendar sync, all inside ORBIT." },
];

const STUDENT_POINTS = [
  "A personal For You feed ranked by your goals and interests",
  "One-tap tickets with a QR code for the door",
  "Add to Google, Apple or Outlook calendar in a tap",
  "Follow societies and employers to hear first",
];

const ORGANISER_POINTS = [
  "Publish an event in minutes, free or ticketed",
  "Approve applications, run a waitlist, check guests in by QR",
  "Reach students looking for exactly what you run",
  "Invite your committee to share the studio",
];

const FAQ = [
  { q: "What is ORBIT?", a: "ORBIT is a home for career events, networking nights and socials. It brings events from universities, societies and employers into one personalised feed." },
  { q: "Is ORBIT free for students?", a: "Yes. Browsing, saving and booking free events costs nothing. Some organisers charge for paid tickets, and you always see the price first." },
  { q: "Can I install ORBIT on my phone?", a: "ORBIT is a web app you can install straight from your browser. On iPhone use Share then Add to Home Screen. On Android and desktop Chrome use the Install button." },
  { q: "How do I host an event?", a: "Create an account, set up your organisation and, once it's approved, publish events from the organiser studio. Societies, employers and university teams are all welcome." },
  { q: "How are events picked for me?", a: "Your goals, interests, saved events and schedule feed a simple ranking, so what you see first is what's most relevant this week." },
];

const eyebrow = "font-display text-[11px] font-semibold uppercase tracking-[0.28em] text-subtle";

export default function Welcome() {
  return (
    <>
      <JsonLd data={buildSiteJsonLd()} />
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-[max(env(safe-area-inset-top),1.25rem)]">
        <Link href="/" className="flex items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
          <Image src="/brand/orbit-mark.png" alt="ORBIT logo" width={30} height={30} />
          <span className="font-display text-sm font-semibold tracking-[0.34em]">ORBIT</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          <a href="#events" className="hidden rounded-full px-3 py-2 text-sm text-muted hover:text-fg sm:inline">Events</a>
          <a href="#how" className="hidden rounded-full px-3 py-2 text-sm text-muted hover:text-fg sm:inline">How it works</a>
          <ButtonLink href="/login" variant="secondary" size="sm">Sign in</ButtonLink>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-2 px-5 pb-12 pt-6 md:grid-cols-[1.15fr_1fr] md:gap-8 md:pb-20 md:pt-14">
          <div className="order-2 text-center md:order-1 md:text-left">
            <p className={eyebrow}>Explore opportunities</p>
            <h1 className="mt-3 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Career events, networking &amp; socials <span className="text-gradient">— all in one place</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted md:mx-0 md:text-lg">
              ORBIT finds the careers fairs, employer talks, society nights and meet-ups worth your time, ranks them for your goals,
              and lets you book in one tap.
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center md:justify-start">
              <ButtonLink href="/login" size="lg" className="w-full sm:w-auto">Get started</ButtonLink>
              <InstallButton size="lg" label="Install the app" className="w-full sm:w-auto" />
            </div>
          </div>
          <div className="order-1 flex justify-center md:order-2">
            <div className="origin-center scale-[0.8] sm:scale-100">
              <OrbitEmblem size={150} />
            </div>
          </div>
        </section>

        <section id="how" aria-labelledby="how-h" className="mx-auto max-w-6xl px-5 py-12">
          <p className={eyebrow}>Simple by design</p>
          <h2 id="how-h" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="border-gradient rounded-[22px] p-5">
                <span aria-hidden className="bg-gradient flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-bg">{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="events" aria-labelledby="events-h" className="mx-auto max-w-6xl px-5 py-12">
          <p className={eyebrow}>Happening soon</p>
          <h2 id="events-h" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Upcoming events</h2>
          <Suspense fallback={<EventsSkeleton />}>
            <UpcomingEvents />
          </Suspense>
        </section>

        <section aria-labelledby="who-h" className="mx-auto max-w-6xl px-5 py-12">
          <h2 id="who-h" className="sr-only">Who ORBIT is for</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="glass rounded-[26px] p-6">
              <p className={eyebrow}>For students</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">Never miss the right event</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-muted">
                {STUDENT_POINTS.map((p) => <Point key={p}>{p}</Point>)}
              </ul>
              <ButtonLink href="/login" className="mt-6">Get started</ButtonLink>
            </div>
            <div className="glass rounded-[26px] p-6">
              <p className={eyebrow}>For organisers</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">Fill the room with the right people</h3>
              <ul className="mt-4 space-y-2.5 text-sm text-muted">
                {ORGANISER_POINTS.map((p) => <Point key={p}>{p}</Point>)}
              </ul>
              <ButtonLink href="/login?next=/onboarding?intent=host" variant="secondary" className="mt-6">
                Hosting events? Set up your organisation
              </ButtonLink>
            </div>
          </div>
        </section>

        <section aria-labelledby="faq-h" className="mx-auto max-w-3xl px-5 py-12">
          <p className={eyebrow}>Good to know</p>
          <h2 id="faq-h" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Frequently asked questions</h2>
          <div className="mt-6 space-y-3">
            {FAQ.map((f) => (
              <details key={f.q} className="glass group rounded-[20px] px-5 py-4">
                <summary className="cursor-pointer list-none font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                  <span className="flex items-center justify-between gap-4">
                    {f.q}
                    <span aria-hidden className="text-muted transition group-open:rotate-45">+</span>
                  </span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="cta-h" className="mx-auto max-w-3xl px-5 pb-16 pt-6 text-center">
          <h2 id="cta-h" className="text-2xl font-semibold tracking-tight sm:text-3xl">Find your next opportunity</h2>
          <p className="mt-2 text-muted">Free to join. Takes less than a minute.</p>
          <ButtonLink href="/login" size="lg" className="mt-6">Get started</ButtonLink>
        </section>
      </main>

      <footer className="border-t border-white/[0.07]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 pb-[max(env(safe-area-inset-bottom),2rem)] text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display text-xs font-semibold tracking-[0.3em] text-fg/80">ORBIT <span className="font-sans tracking-normal text-muted">· Explore opportunities</span></p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/login" className="hover:text-fg">Sign in</Link>
            <Link href="/login?next=/onboarding?intent=host" className="hover:text-fg">Host an event</Link>
            <a href="#events" className="hover:text-fg">Upcoming events</a>
            <a href="#faq-h" className="hover:text-fg">FAQ</a>
          </nav>
        </div>
      </footer>
    </>
  );
}

function Point({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden className="mt-0.5 text-accent">✓</span>
      <span>{children}</span>
    </li>
  );
}

async function UpcomingEvents() {
  const events = await listLandingEvents(6);
  if (events.length === 0) {
    return <p className="mt-6 rounded-[22px] border border-dashed border-white/12 bg-white/[0.025] px-4 py-10 text-center text-sm text-muted">No events are listed right now. Check back soon, or sign in to be first to hear.</p>;
  }
  return (
    <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((e) => {
        const price = formatPrice(e.price_min, e.price_min, e.currency ?? "GBP");
        const where = e.format === "online" ? "Online" : (e.venue_name ?? e.city ?? FORMAT_LABELS[e.format]);
        return (
          <li key={e.id}>
            <Link href={`/events/${e.id}`} className="glass group block overflow-hidden rounded-[22px] transition duration-200 hover:border-white/15 hover:bg-white/[0.07] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent motion-reduce:transition-none">
              <div className="aspect-[16/9] w-full overflow-hidden"><EventCover src={e.cover_url} title={e.title} width={600} /></div>
              <div className="p-4">
                <p className="text-xs font-medium text-accent">{formatEventDate(e.starts_at)}</p>
                <h3 className="mt-1 line-clamp-2 font-semibold leading-snug tracking-tight">{e.title}</h3>
                <p className="mt-1 truncate text-sm text-muted">{where}{e.organiser ? ` · ${e.organiser.name}` : ""}</p>
                {price && <p className="mt-2 text-xs text-subtle">{price}</p>}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EventsSkeleton() {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((i) => <div key={i} className="h-60 animate-pulse rounded-[22px] bg-white/[0.04]" />)}
    </div>
  );
}
