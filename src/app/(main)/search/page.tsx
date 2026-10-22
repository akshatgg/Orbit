import { Suspense } from "react";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EventRows } from "@/components/events/EventRow";
import { EventTile } from "@/components/events/EventTile";
import { CategoryRail } from "@/components/discovery/CategoryRail";
import { FilterBar } from "@/components/discovery/FilterBar";
import { ICONS, SearchSkeleton, SectionHeading } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import {
  clearFiltersHref, isSearching, parseSearchFilters, SORT_OPTIONS, toSearchParams, type SearchFilters,
} from "@/lib/discovery/filters";
import {
  countUpcomingByCategory, getViewer, listHappeningSoon, listUpcomingPlaces, searchEvents, type RankedEvent, type Viewer,
} from "@/lib/discovery/queries";
import { FILTER_KEYS } from "@/lib/discovery/filter-bar";
import { listCategories } from "@/lib/events/queries";

export const metadata: Metadata = { title: "Explore" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      {/* Phones: no visible title, the search box leads the page. Laptops: a normal page heading. */}
      <header className="pt-[var(--page-top,1.25rem)] lg:px-4 lg:pb-6">
        <h1 className="sr-only lg:not-sr-only lg:text-4xl lg:font-semibold lg:leading-tight lg:tracking-tight">Explore</h1>
        <p className="mt-1 hidden text-sm text-muted lg:block">Search every upcoming event, or start from a category.</p>
      </header>
      <Suspense fallback={<SearchSkeleton />}>
        <Explore searchParams={searchParams} />
      </Suspense>
    </>
  );
}

type Category = { id: string; slug: string; name: string; group: string };

async function Explore({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const profile = await requireProfile();
  const filters = parseSearchFilters(await searchParams);
  const viewer = await getViewer(profile);
  const categories = (await listCategories()) as Category[];
  const now = new Date();
  const searching = isSearching(filters);
  const [categoryCounts, places] = await Promise.all([countUpcomingByCategory(now), listUpcomingPlaces()]);

  return (
    <div className="space-y-6 lg:space-y-10">
      <div className="space-y-3 lg:space-y-4">
        <SearchBox filters={filters} />
        <CategoryRail filters={filters} categories={categories.map((c) => ({ value: c.slug, label: c.name }))} />
        <FilterBar
          filters={filters}
          keys={FILTER_KEYS.filter((k) => k !== "category")}
          categories={categories.map((c) => ({
            value: c.slug,
            label: c.name,
            count: categoryCounts.get(c.id) ?? 0,
          }))}
          places={places}
        />
      </div>
      {searching ? (
        <Results filters={filters} viewer={viewer} categories={categories} now={now} />
      ) : (
        <Browse viewer={viewer} now={now} />
      )}
    </div>
  );
}

function SearchBox({ filters }: { filters: SearchFilters }) {
  // Hidden inputs keep the active filters when the search text is submitted.
  const hidden = [...toSearchParams({ ...filters, q: "" }).entries()];
  return (
    <form action="/search" method="get" className="px-4 md:max-w-2xl lg:max-w-3xl" role="search">
      <div className="flex gap-2 lg:gap-3">
        <div className="relative min-w-0 flex-1">
          <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-subtle lg:block" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d={ICONS.search} />
          </svg>
          <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search events, societies, topics"
          aria-label="Search events"
          maxLength={120}
            className="lg:h-14 lg:rounded-[18px] lg:pl-12 lg:text-base"
          />
        </div>
        <SubmitButton size="lg" pendingText="Searching…" className="lg:h-14 lg:rounded-[18px] lg:px-8">Search</SubmitButton>
      </div>
      {hidden.map(([k, v], i) => <input key={`${k}${i}`} type="hidden" name={k} value={v} />)}
    </form>
  );
}

async function Results({ filters, viewer, categories, now }: {
  filters: SearchFilters; viewer: Viewer; categories: Category[]; now: Date;
}) {
  const { results, truncated } = await searchEvents(filters, viewer, categories, now);
  return (
    <>
      <section aria-labelledby="results">
        <SectionHeading
          id="results"
          eyebrow={SORT_OPTIONS.find((s) => s.value === filters.sort)?.label}
          title={filters.q ? `Results for “${filters.q}”` : "Results"}
          count={results.length}
        />
        {results.length === 0 ? (
          <EmptyState
            title="No events match"
            action={<ButtonLink href={clearFiltersHref(filters)} variant="secondary">Clear filters</ButtonLink>}
          >
            Try a different word, widen the dates, or remove a filter.
          </EmptyState>
        ) : (
          <>
            <PhoneRows ranked={results} viewer={viewer} now={now} byDay={filters.sort === "date"} />
            <ul className="hidden px-4 md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-9 lg:grid-cols-4">
              {results.map((r) => <ResultItem key={r.event.id} r={r} viewer={viewer} />)}
            </ul>
          </>
        )}
        {truncated && (
          <p className="mt-4 px-4 text-center text-xs text-muted">Showing the first {results.length}. Narrow your search to see more.</p>
        )}
      </section>
    </>
  );
}

function ResultItem({ r, viewer }: { r: RankedEvent; viewer: Viewer }) {
  return (
    <li>
      <EventTile
        event={r.event}
        saved={viewer.state.saved.has(r.event.id)}
        registration={viewer.state.registrations.get(r.event.id)}
      />
    </li>
  );
}

/** Phones: the events as rows, under day headings when they're in date order. */
function PhoneRows({ ranked, viewer, now, byDay }: { ranked: RankedEvent[]; viewer: Viewer; now: Date; byDay?: boolean }) {
  return (
    <EventRows
      items={ranked.map((r) => ({ event: r.event, registration: viewer.state.registrations.get(r.event.id) }))}
      groupBy={byDay ? "day" : undefined}
      now={now}
      className="px-4 md:hidden"
    />
  );
}

async function Browse({ viewer, now }: { viewer: Viewer; now: Date }) {
  const soon = await listHappeningSoon(viewer, now);
  return (
    <>
      <section aria-labelledby="soon">
        <SectionHeading id="soon" eyebrow="Next 14 days" title="Happening soon" />
        {soon.length === 0 ? (
          <>
            <p className="px-4 text-sm text-muted lg:hidden">Nothing coming up in the next two weeks.</p>
            <div className="hidden lg:block">
              <EmptyState
                title="Nothing in the next two weeks"
                action={<ButtonLink href="/" variant="secondary">See what&rsquo;s on For You</ButtonLink>}
              >
                New events appear here as soon as organisers publish them.
              </EmptyState>
            </div>
          </>
        ) : (
          <>
            <PhoneRows ranked={soon} viewer={viewer} now={now} byDay />
            <ul className="hidden px-4 md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-9 lg:grid-cols-4">
              {soon.map((r) => <ResultItem key={r.event.id} r={r} viewer={viewer} />)}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
