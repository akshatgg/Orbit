import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RankedCard } from "@/components/discovery/Cards";
import { FilterBar } from "@/components/discovery/FilterBar";
import { DiscoveryHeader, SearchSkeleton, SectionHeading } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import {
  clearFiltersHref, isSearching, parseSearchFilters, searchHref, SORT_OPTIONS, toSearchParams, type SearchFilters,
} from "@/lib/discovery/filters";
import {
  countUpcomingByCategory, getViewer, listHappeningSoon, searchEvents, type RankedEvent, type Viewer,
} from "@/lib/discovery/queries";
import { listCategories } from "@/lib/events/queries";

export const metadata: Metadata = { title: "Explore" };

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <>
      <DiscoveryHeader title="Explore" subtitle="Search every event" />
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

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SearchBox filters={filters} />
        <FilterBar filters={filters} categories={categories.map((c) => ({ value: c.slug, label: c.name }))} />
      </div>
      {searching ? (
        <Results filters={filters} viewer={viewer} categories={categories} now={now} />
      ) : (
        <Browse viewer={viewer} categories={categories} now={now} />
      )}
    </div>
  );
}

function SearchBox({ filters }: { filters: SearchFilters }) {
  // Hidden inputs keep the active filters when the search text is submitted.
  const hidden = [...toSearchParams({ ...filters, q: "" }).entries()];
  return (
    <form action="/search" method="get" className="px-4" role="search">
      <div className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search events, societies, topics"
          aria-label="Search events"
          maxLength={120}
        />
        <SubmitButton size="lg">Search</SubmitButton>
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
          <ul className="space-y-3 px-4">
            {results.map((r) => <ResultItem key={r.event.id} r={r} viewer={viewer} />)}
          </ul>
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
      <RankedCard
        event={r.event}
        counts={r.event.counts}
        saved={viewer.state.saved.has(r.event.id)}
        registration={viewer.state.registrations.get(r.event.id)}
        reason={r.reason}
      />
    </li>
  );
}

async function Browse({ viewer, categories, now }: { viewer: Viewer; categories: Category[]; now: Date }) {
  const [soon, counts] = await Promise.all([listHappeningSoon(viewer, now), countUpcomingByCategory(now)]);
  const base = parseSearchFilters({});
  return (
    <>
      <section aria-labelledby="by-category">
        <SectionHeading id="by-category" eyebrow="Browse" title="By category" />
        <ul className="grid grid-cols-2 gap-2 px-4">
          {categories.map((c) => (
            <li key={c.id}>
              <Link
                href={searchHref({ ...base, categories: [c.slug] })}
                className="glass flex items-center justify-between gap-2 rounded-[18px] px-3.5 py-3 text-sm transition duration-200 hover:bg-white/[0.09] active:scale-[0.98] motion-reduce:transition-none"
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-xs tabular-nums text-subtle">{counts.get(c.id) ?? 0}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="soon">
        <SectionHeading id="soon" eyebrow="Next 14 days" title="Happening soon" />
        {soon.length === 0 ? (
          <p className="px-4 text-sm text-muted">Nothing coming up in the next two weeks.</p>
        ) : (
          <ul className="space-y-3 px-4">
            {soon.map((r) => <ResultItem key={r.event.id} r={r} viewer={viewer} />)}
          </ul>
        )}
      </section>
    </>
  );
}
