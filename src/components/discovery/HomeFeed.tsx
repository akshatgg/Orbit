import Link from "next/link";
import type { ReactNode } from "react";
import { EventCover } from "@/components/events/EventCover";
import { EventRows } from "@/components/events/EventRow";
import { EventTile } from "@/components/events/EventTile";
import { ButtonLink } from "@/components/ui/Button";
import { placeValue } from "@/lib/discovery/filter-bar";
import { parseSearchFilters, placeLabel, searchHref, type SearchFilters } from "@/lib/discovery/filters";
import { listHappeningSoon, listUpcomingPlaces, searchEvents, type RankedEvent, type Viewer } from "@/lib/discovery/queries";
import { cityVariants, placeOf } from "@/lib/places";
import { DismissProvider } from "./Dismiss";
import { CategoryIcons, PosterCarousel, posterPicks } from "./HomeSections";
import { HomePlacePicker } from "./HomePlacePicker";

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

const GRID_LIMIT = 16;

function inPlace(r: RankedEvent, place: Pick<SearchFilters, "country" | "city">) {
  if (!place.country && !place.city) return true;
  const where = placeOf(r.event.city, r.event.country);
  if (place.city && !cityVariants(place.city).some((c) => c.toLowerCase() === (where.city ?? "").toLowerCase())) return false;
  return !place.country || where.country === place.country;
}

/**
 * The For You page, laid out like Eventbrite's home on every screen: a banner carousel of top picks,
 * round category icons, "Browsing events in [place]" with All / For you / Today / This weekend, then
 * the events (rows by day on phones, a card grid on tablets and laptops) and the places with events.
 */
export async function HomeFeed({ viewer, ranked, view, place, now, nudge }: {
  viewer: Viewer;
  ranked: RankedEvent[];
  view: HomeView;
  place: Pick<SearchFilters, "country" | "city">;
  now: Date;
  /** Shown above the lists (e.g. "pick a few interests"). */
  nudge?: ReactNode;
}) {
  const places = await listUpcomingPlaces();
  const state = viewer.state;
  const picks = posterPicks(ranked.length ? ranked : await listHappeningSoon(8));

  // The events for the chosen tab, soonest first.
  let items: RankedEvent[];
  let moreHref: string;
  if (view === "foryou") {
    items = ranked.filter((r) => inPlace(r, place));
    moreHref = searchHref(parseSearchFilters({ country: place.country ?? undefined, city: place.city || undefined }));
  } else {
    const filters = parseSearchFilters({
      date: view === "all" ? undefined : view, country: place.country ?? undefined, city: place.city || undefined, sort: "date",
    });
    items = (await searchEvents(filters)).results;
    moreHref = searchHref(filters);
  }
  const byDate = [...items].sort((a, b) => Date.parse(a.event.starts_at) - Date.parse(b.event.starts_at));
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
    <DismissProvider>
      <div className="space-y-9 px-4 pb-4 pt-4 md:space-y-12 md:pt-6 lg:space-y-14">
        <PosterCarousel picks={picks} />
        <CategoryIcons />
        {nudge}

        <section id="browse" aria-labelledby="browse-heading" className="scroll-mt-24">
          <div className="flex flex-col gap-0.5 border-y border-line py-3 md:flex-row md:flex-wrap md:items-center md:gap-x-2 md:py-4">
            <p className="text-lg font-semibold tracking-tight text-muted md:text-2xl">Browsing events in</p>
            <HomePlacePicker places={places} value={placeValue(place.country, place.city)} view={view} />
          </div>
          <nav aria-label="Show" className="scrollbar-none -mx-4 flex gap-5 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] md:mx-0 md:gap-6 md:px-0 [&::-webkit-scrollbar]:hidden">
            {HOME_VIEWS.map((v) => {
              const active = v.value === view;
              return (
                <Link
                  key={v.value}
                  href={tabHref(v.value)}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px shrink-0 border-b-2 py-3 text-[15px] font-medium transition-colors md:py-3.5 ${
                    active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
                  }`}
                >
                  {v.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 flex items-end justify-between gap-4 md:mt-8">
            <h2 id="browse-heading" className="text-[1.4rem] font-semibold tracking-tight md:text-[1.65rem]">{heading}</h2>
            {items.length > GRID_LIMIT && (
              <Link href={moreHref} className="hidden shrink-0 text-sm font-semibold text-accent hover:underline md:inline">See all {items.length}</Link>
            )}
          </div>
          {items.length === 0 ? (
            <div className="mt-5 rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-10 text-center md:mt-6">
              <p className="font-semibold">Nothing here yet</p>
              <p className="mt-1 text-sm text-muted">Try another tab or place, or search every event.</p>
              <div className="mt-4 flex justify-center"><ButtonLink href={moreHref} variant="secondary" size="sm">Explore events</ButtonLink></div>
            </div>
          ) : (
            <>
              {/* Phones: rows under day headings. */}
              <EventRows
                items={byDate.map((r) => ({ event: r.event, registration: state.registrations.get(r.event.id) }))}
                groupBy="day"
                now={now}
                dismissible={view === "foryou"}
                className="mt-4 md:hidden"
              />
              {/* Tablets and laptops: a card grid. */}
              <ul className="mt-6 hidden grid-cols-2 gap-x-5 gap-y-9 md:grid lg:grid-cols-4">
                {(view === "foryou" ? items : byDate).slice(0, GRID_LIMIT).map((r) => (
                  <li key={r.event.id}>
                    <EventTile event={r.event} registration={state.registrations.get(r.event.id)} saved={state.saved.has(r.event.id)} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {topCities.length > 1 && (
          <section aria-labelledby="places-heading">
            <h2 id="places-heading" className="text-[1.4rem] font-semibold tracking-tight md:text-[1.65rem]">Places with events</h2>
            <ul className="mt-4 grid grid-cols-2 gap-3 md:mt-6 md:gap-4 lg:grid-cols-4">
              {topCities.map((c) => (
                <li key={`${c.country}-${c.city}`}>
                  <Link
                    href={searchHref(parseSearchFilters({ country: c.country ?? undefined, city: c.city }))}
                    className="group relative flex h-28 flex-col justify-end overflow-hidden rounded-[20px] p-4 ring-1 ring-ink/10 transition duration-200 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 md:h-32"
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

        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-ink/12 bg-ink/[0.025] px-6 py-6 text-center">
          <p className="text-sm text-muted">Looking for something specific?</p>
          <ButtonLink href={moreHref} variant="secondary" size="sm">Search every event</ButtonLink>
        </div>
      </div>
    </DismissProvider>
  );
}
