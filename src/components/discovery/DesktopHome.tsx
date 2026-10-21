import Link from "next/link";
import type { Category } from "@/types/database";
import { EventCover } from "@/components/events/EventCover";
import { EventTile } from "@/components/events/EventTile";
import { ButtonLink } from "@/components/ui/Button";
import { placeValue } from "@/lib/discovery/filter-bar";
import { reasonTag } from "@/lib/discovery/feed-display";
import { parseSearchFilters, placeLabel, searchHref, type SearchFilters } from "@/lib/discovery/filters";
import { listHappeningSoon, listUpcomingPlaces, searchEvents, type RankedEvent, type Viewer } from "@/lib/discovery/queries";
import { listCategories } from "@/lib/events/queries";
import { seriesHint } from "@/lib/events/series";
import { formatEventDate, formatPrice } from "@/lib/format";
import { cityVariants, placeOf } from "@/lib/places";
import { HomeCarousel } from "./HomeCarousel";
import { HomePlacePicker } from "./HomePlacePicker";
import { eventPlace } from "@/components/events/EventRow";

export const HOME_VIEWS = [
  { value: "all", label: "All" },
  { value: "foryou", label: "For you" },
  { value: "today", label: "Today" },
  { value: "weekend", label: "This weekend" },
] as const;
export type HomeView = (typeof HOME_VIEWS)[number]["value"];

export function parseHomeView(raw: string | string[] | undefined): HomeView {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return HOME_VIEWS.some((x) => x.value === v) ? (v as HomeView) : "foryou";
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

const GRID_LIMIT = 16;

function inPlace(r: RankedEvent, place: Pick<SearchFilters, "country" | "city">) {
  if (!place.country && !place.city) return true;
  const where = placeOf(r.event.city, r.event.country);
  if (place.city && !cityVariants(place.city).some((c) => c.toLowerCase() === (where.city ?? "").toLowerCase())) return false;
  return !place.country || where.country === place.country;
}

/**
 * The For You page on tablets and laptops, laid out like Eventbrite's home: a big poster carousel,
 * a row of category icons, "Browsing events in [place]" with All / For you / Today / This weekend,
 * a grid of event cards, and the places that have events. Phones keep their own layout.
 */
export async function DesktopHome({ viewer, ranked, view, place, now }: {
  viewer: Viewer;
  ranked: RankedEvent[];
  view: HomeView;
  place: Pick<SearchFilters, "country" | "city">;
  now: Date;
}) {
  const places = await listUpcomingPlaces();
  const state = viewer.state;

  // The poster: your top picks with a cover first (or what's on soon when there are none).
  const pool = ranked.length ? ranked : await listHappeningSoon(viewer, now, 8);
  const slides = [...pool.filter((r) => r.event.cover_url), ...pool.filter((r) => !r.event.cover_url)].slice(0, 5);

  // The grid for the chosen tab.
  let items: RankedEvent[];
  let moreHref: string;
  if (view === "foryou") {
    items = ranked.filter((r) => inPlace(r, place));
    moreHref = searchHref(parseSearchFilters({ country: place.country ?? undefined, city: place.city || undefined }));
  } else {
    const filters = parseSearchFilters({
      date: view === "all" ? undefined : view, country: place.country ?? undefined, city: place.city || undefined, sort: "date",
    });
    const categories = (await listCategories()) as Pick<Category, "id" | "slug">[];
    items = (await searchEvents(filters, viewer, categories, now)).results;
    moreHref = searchHref(filters);
  }
  const where = placeLabel(place);
  const heading = { all: "Upcoming events", foryou: "Picked for you", today: "Happening today", weekend: "This weekend" }[view] + (where ? ` in ${where}` : "");
  const tabHref = (v: HomeView) => {
    const params = new URLSearchParams();
    if (v !== "foryou") params.set("view", v);
    if (place.country) params.set("country", place.country);
    if (place.city) params.set("city", place.city);
    const qs = params.toString();
    return qs ? `/?${qs}#browse` : "/#browse";
  };

  const topCities = places
    .flatMap((g) => g.cities.map((c) => ({ ...c, country: g.country, flag: g.flag })))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return (
    <div className="space-y-12 px-4 pb-4 pt-6 lg:space-y-14">
      {slides.length > 0 && (
        <HomeCarousel
          labels={slides.map((r) => r.event.title)}
          slides={slides.map((r) => <PosterSlide key={r.event.id} r={r} />)}
        />
      )}

      <nav aria-label="Browse by interest">
        <ul className="grid grid-cols-6 gap-x-3 gap-y-6 lg:grid-cols-12">
          {CATEGORY_ICONS.map((c) => (
            <li key={c.value}>
              <Link
                href={`/search?interest=${c.value}`}
                className="group flex flex-col items-center gap-2.5 rounded-2xl text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                <span className="flex h-[72px] w-[72px] items-center justify-center rounded-full border border-ink/10 bg-ink/[0.04] text-fg transition duration-200 ease-out group-hover:-translate-y-0.5 group-hover:border-accent/40 group-hover:bg-accent/10 group-hover:text-accent motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 lg:h-[76px] lg:w-[76px]">
                  <svg aria-hidden viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d={c.path} /></svg>
                </span>
                <span className="text-[12.5px] font-medium leading-tight text-muted group-hover:text-fg">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section id="browse" aria-labelledby="browse-heading" className="scroll-mt-24">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-y border-line py-4">
          <p className="text-2xl font-semibold tracking-tight text-muted">Browsing events in</p>
          <HomePlacePicker places={places} value={placeValue(place.country, place.city)} view={view} />
        </div>
        <nav aria-label="Show" className="flex gap-6 border-b border-line">
          {HOME_VIEWS.map((v) => {
            const active = v.value === view;
            return (
              <Link
                key={v.value}
                href={tabHref(v.value)}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={`-mb-px border-b-2 py-3.5 text-[15px] font-medium transition-colors ${
                  active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
                }`}
              >
                {v.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 flex items-end justify-between gap-4">
          <h2 id="browse-heading" className="text-[1.65rem] font-semibold tracking-tight">{heading}</h2>
          {items.length > GRID_LIMIT && (
            <Link href={moreHref} className="shrink-0 text-sm font-semibold text-accent hover:underline">See all {items.length}</Link>
          )}
        </div>
        {items.length === 0 ? (
          <div className="mt-6 rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-10 text-center">
            <p className="font-semibold">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted">Try another tab or place, or search every event.</p>
            <div className="mt-4 flex justify-center"><ButtonLink href={moreHref} variant="secondary" size="sm">Explore events</ButtonLink></div>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-2 gap-x-5 gap-y-9 lg:grid-cols-4">
            {items.slice(0, GRID_LIMIT).map((r) => (
              <li key={r.event.id}>
                <EventTile event={r.event} registration={state.registrations.get(r.event.id)} saved={state.saved.has(r.event.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {topCities.length > 1 && (
        <section aria-labelledby="places-heading">
          <h2 id="places-heading" className="text-[1.65rem] font-semibold tracking-tight">Places with events</h2>
          <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {topCities.map((c) => (
              <li key={`${c.country}-${c.city}`}>
                <Link
                  href={searchHref(parseSearchFilters({ country: c.country ?? undefined, city: c.city }))}
                  className="group relative flex h-32 flex-col justify-end overflow-hidden rounded-[20px] p-4 ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <EventCover title={c.city} className="absolute inset-0" />
                  <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <span aria-hidden className="absolute right-3.5 top-3 text-2xl">{c.flag}</span>
                  <span className="relative text-lg font-semibold text-white">{c.city}</span>
                  <span className="relative text-xs text-white/75">{c.count} event{c.count === 1 ? "" : "s"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** One poster: the cover blurred behind, the title and details on the left, the full poster on the right. */
function PosterSlide({ r }: { r: RankedEvent }) {
  const e = r.event;
  const price = formatPrice(e.price_min, e.price_max, e.currency);
  const tag = reasonTag(r.reason) ?? e.category?.name ?? "Top pick for you";
  return (
    <Link href={`/events/${e.id}`} className="relative block h-[380px] overflow-hidden bg-black lg:h-[420px]">
      <EventCover src={e.cover_url} title={e.title} width={1200} className="absolute inset-0 scale-110 opacity-60 blur-2xl" />
      <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/55 to-black/10" />
      <div className="relative flex h-full items-center gap-10 px-10 lg:px-14">
        <div className="min-w-0 flex-1 text-white">
          <span className="inline-flex max-w-full truncate rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">{tag}</span>
          <h2 className="mt-4 line-clamp-3 text-[2.1rem] font-bold leading-[1.1] tracking-tight lg:text-[2.75rem]">{e.title}</h2>
          <p className="mt-4 text-[15px] text-white/85">
            {formatEventDate(e.starts_at)}{seriesHint(e)}
          </p>
          <p className="mt-1 truncate text-[15px] text-white/70">{eventPlace(e).text}{e.organiser ? ` · ${e.organiser.name}` : ""}</p>
          <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
            {e.registration_mode === "tickets" ? (price === "Free" ? "Get a free ticket" : "Get tickets") : "View event"}
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
