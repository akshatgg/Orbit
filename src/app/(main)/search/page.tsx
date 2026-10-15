import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { ChipGroup } from "@/components/ui/ChipGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RankedCard } from "@/components/discovery/Cards";
import { DiscoveryHeader, SearchSkeleton, SectionHeading } from "@/components/discovery/Layout";
import { requireProfile } from "@/lib/auth";
import {
  activeFilterChips, activeFilterCount, clearFiltersHref, DATE_PRESETS, isSearching, parseSearchFilters,
  PRICE_OPTIONS, searchHref, SORT_OPTIONS, type SearchFilters,
} from "@/lib/discovery/filters";
import {
  countUpcomingByCategory, getViewer, listHappeningSoon, searchEvents, type RankedEvent, type Viewer,
} from "@/lib/discovery/queries";
import { listCategories } from "@/lib/events/queries";
import { CAREER_INTERESTS, EVENT_FORMATS } from "@/lib/taxonomy";

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
  const count = activeFilterCount(filters);
  const names = new Map(categories.map((c) => [c.slug, c.name]));

  return (
    <div className="space-y-6">
      <FilterForm filters={filters} categories={categories} open={count > 0} count={count} />
      {searching ? (
        <Results filters={filters} viewer={viewer} categories={categories} now={now} names={names} />
      ) : (
        <Browse viewer={viewer} categories={categories} now={now} />
      )}
    </div>
  );
}

function FilterForm({ filters, categories, open, count }: {
  filters: SearchFilters; categories: Category[]; open: boolean; count: number;
}) {
  const label = "mb-2 block font-display text-[10px] font-semibold uppercase tracking-[0.3em] text-muted";
  return (
    <form action="/search" method="get" className="space-y-3 px-4" role="search">
      <div className="flex gap-2">
        <Input
          type="search"
          name="q"
          defaultValue={filters.q}
          placeholder="Search events, societies, topics"
          aria-label="Search events"
          maxLength={120}
        />
        <SubmitButton>Search</SubmitButton>
      </div>

      <details open={open} className="group rounded-2xl border border-line bg-surface">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span>
            Filters
            {count > 0 && <span className="ml-2 rounded-full bg-gradient px-2 py-0.5 text-[11px] font-semibold text-bg">{count}</span>}
          </span>
          <span aria-hidden className="text-muted transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-5 border-t border-line px-4 py-4">
          <fieldset>
            <legend className={label}>When</legend>
            <ChipGroup name="date" multiple={false} options={DATE_PRESETS} defaultValue={filters.date ? [filters.date] : []} />
          </fieldset>
          <fieldset>
            <legend className={label}>Category</legend>
            <ChipGroup
              name="category"
              options={categories.map((c) => ({ value: c.slug, label: c.name }))}
              defaultValue={filters.categories}
            />
          </fieldset>
          <fieldset>
            <legend className={label}>Career interest</legend>
            <ChipGroup name="interest" options={[...CAREER_INTERESTS]} defaultValue={filters.interests} />
          </fieldset>
          <fieldset>
            <legend className={label}>Format</legend>
            <ChipGroup name="format" options={[...EVENT_FORMATS]} defaultValue={filters.formats} />
          </fieldset>
          <fieldset>
            <legend className={label}>Price</legend>
            <ChipGroup name="price" multiple={false} options={[...PRICE_OPTIONS]} defaultValue={filters.price ? [filters.price] : []} />
          </fieldset>
          <div>
            <label htmlFor="location" className={label}>Location</label>
            <Input id="location" name="location" defaultValue={filters.location} placeholder="e.g. South Kensington" maxLength={60} />
          </div>
          <fieldset>
            <legend className={label}>Sort by</legend>
            <ChipGroup name="sort" multiple={false} options={[...SORT_OPTIONS]} defaultValue={[filters.sort]} />
          </fieldset>
          <div className="flex items-center justify-between gap-3">
            <Link href={clearFiltersHref(filters)} className="text-sm text-muted hover:text-fg">Clear filters</Link>
            <SubmitButton>Show results</SubmitButton>
          </div>
        </div>
      </details>
    </form>
  );
}

async function Results({ filters, viewer, categories, now, names }: {
  filters: SearchFilters; viewer: Viewer; categories: Category[]; now: Date; names: ReadonlyMap<string, string>;
}) {
  const { results, truncated } = await searchEvents(filters, viewer, categories, now);
  const chips = activeFilterChips(filters, names);
  return (
    <>
      {chips.length > 0 && (
        <ul className="flex flex-wrap gap-2 px-4" aria-label="Active filters">
          {chips.map((c) => (
            <li key={c.key}>
              <Link
                href={c.href}
                aria-label={`Remove filter ${c.label}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1 text-xs hover:border-violet/60"
              >
                {c.label} <span aria-hidden className="text-muted">✕</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

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
                className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm transition-colors hover:border-violet/50"
              >
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-xs text-muted">{counts.get(c.id) ?? 0}</span>
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
