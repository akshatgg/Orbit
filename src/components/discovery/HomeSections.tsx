import Link from "next/link";
import { EventCover } from "@/components/events/EventCover";
import { eventPlace } from "@/components/events/EventRow";
import { reasonTag } from "@/lib/discovery/feed-display";
import type { RankedEvent } from "@/lib/discovery/queries";
import { seriesHint } from "@/lib/events/series";
import { formatEventDate, formatPrice } from "@/lib/format";
import { HomeCarousel } from "./HomeCarousel";

// The top of the For You page, shared by phones and laptops (Eventbrite style): a poster carousel
// of top picks, then round category icons.

/** Top picks for the poster: the ones with a cover first. */
export function posterPicks(pool: RankedEvent[], count = 5): RankedEvent[] {
  return [...pool.filter((r) => r.event.cover_url), ...pool.filter((r) => !r.event.cover_url)].slice(0, count);
}

export function PosterCarousel({ picks }: { picks: RankedEvent[] }) {
  if (!picks.length) return null;
  return (
    <HomeCarousel
      labels={picks.map((r) => r.event.title)}
      slides={picks.map((r) => <PosterSlide key={r.event.id} r={r} />)}
    />
  );
}

/**
 * One banner, the same on every screen: the cover blurred behind, the title, details and button on
 * the left, and (on laptops, where there's room) the full poster on the right.
 */
function PosterSlide({ r }: { r: RankedEvent }) {
  const e = r.event;
  const price = formatPrice(e.price_min, e.price_max, e.currency);
  const tag = reasonTag(r.reason) ?? e.category?.name ?? "Top pick for you";
  const cta = e.registration_mode === "tickets" ? (price === "Free" ? "Get a free ticket" : "Get tickets") : "View event";
  return (
    <Link href={`/events/${e.id}`} className="relative block h-[340px] overflow-hidden bg-black md:h-[380px] lg:h-[420px]">
      <EventCover src={e.cover_url} title={e.title} width={1200} className="absolute inset-0 scale-110 opacity-60 blur-2xl" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
      <div className="relative flex h-full items-center gap-10 px-6 pb-6 md:px-10 md:pb-0 lg:px-14">
        <div className="min-w-0 flex-1 text-white">
          <span className="inline-flex max-w-full truncate rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
            {tag}
          </span>
          <h2 className="mt-4 line-clamp-3 text-[1.7rem] font-bold leading-[1.1] tracking-tight md:text-[2.1rem] lg:text-[2.75rem]">{e.title}</h2>
          <p className="mt-3 text-sm text-white/85 md:mt-4 md:text-[15px]">
            {formatEventDate(e.starts_at)}{seriesHint(e)}
          </p>
          <p className="mt-0.5 truncate text-sm text-white/70 md:mt-1 md:text-[15px]">{eventPlace(e).text}{e.organiser ? ` · ${e.organiser.name}` : ""}</p>
          <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black md:mt-6">
            {cta}
            {price && price !== "Free" && <span className="font-normal text-black/60">from {price.split(" – ")[0]}</span>}
          </span>
        </div>
        <div className="hidden aspect-square h-[78%] shrink-0 overflow-hidden rounded-[22px] shadow-[0_30px_80px_rgb(0_0_0/0.55)] ring-1 ring-white/15 lg:block">
          <EventCover src={e.cover_url} title={e.title} width={800} fit="contain" />
        </div>
      </div>
    </Link>
  );
}

/** The interests shown as round icons under the poster (Eventbrite's category row). */
const CATEGORY_ICONS: { value: string; label: string; path: string }[] = [
  { value: "ai", label: "AI", path: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" },
  { value: "technology", label: "Tech", path: "M5 6h14v9H5zM3 18h18M9 9l-2 1.5L9 12m6-3 2 1.5-2 1.5" },
  { value: "careers", label: "Careers", path: "M4 17l5-5 4 4 7-7m0 0h-5m5 0v5" },
  { value: "entrepreneurship", label: "Startups", path: "M14 4c3 0 6 3 6 6l-6 6-4-4 6-6M10 14l-4 1-2 4 4-2 1-4m6-7.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3" },
  { value: "socialising", label: "Socials", path: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-6 8a6 6 0 0 1 12 0m1-8a3 3 0 1 0 0-6m2 14a6 6 0 0 0-3-5.2" },
  { value: "music", label: "Music & nightlife", path: "M9 18V6l11-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm11-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" },
  { value: "food", label: "Food & drink", path: "M5 3v8a3 3 0 0 0 6 0V3M8 3v18m8-18c-2 2-2 6 0 8v10m0-18c2 2 2 6 0 8" },
  { value: "arts", label: "Arts & culture", path: "M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.6 0-1.2-1-1.4-1-2.4 0-.9.7-1.5 1.6-1.5H17a4 4 0 0 0 4-4c0-4.7-4-8.5-9-8.5zM7.5 11.5h0m3-4h0m4 0h0" },
  { value: "fitness", label: "Fitness & sport", path: "M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12" },
  { value: "gaming", label: "Gaming", path: "M7 9h10a4 4 0 0 1 4 4v1a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-1a4 4 0 0 1 4-4zm1 2v3m-1.5-1.5h3M16 12h0m2 1.5h0" },
  { value: "books", label: "Books", path: "M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zm0 15a2 2 0 0 0 2 2h13v-4" },
  { value: "wellbeing", label: "Wellbeing", path: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" },
];

/** Round icons linking to Explore by interest: 4 per row on phones, 6 on tablets, one row on laptops. */
export function CategoryIcons() {
  return (
    <nav aria-label="Browse by interest">
      <ul className="grid grid-cols-4 gap-x-2 gap-y-5 md:grid-cols-6 md:gap-x-3 md:gap-y-6 lg:grid-cols-12">
        {CATEGORY_ICONS.map((c) => (
          <li key={c.value}>
            <Link
              href={`/search?interest=${c.value}`}
              className="group flex flex-col items-center gap-2 rounded-2xl text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:gap-2.5"
            >
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-ink/10 bg-ink/[0.04] text-fg transition duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-accent group-active:scale-95 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 md:h-[72px] md:w-[72px] lg:h-[76px] lg:w-[76px]">
                <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6 md:h-7 md:w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={c.path} /></svg>
              </span>
              <span className="text-[12px] font-medium leading-tight text-muted group-hover:text-fg md:text-[12.5px]">{c.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
